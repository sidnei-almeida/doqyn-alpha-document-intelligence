import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { isCompleteWhatsapp } from '@/lib/identifiers';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import type { DocumentListItem } from '@/types/document-library';
import {
  AccessList,
  AudiencePicker,
  ConditionsStep,
  EMPTY_EXTERNAL_RECIPIENT,
  ExternalRecipientFields,
  FlowFooter,
  InternalRecipientPicker,
  IssuedLink,
  StepTrack,
  SummaryStep,
  defaultExpirationDate,
  expirationDateToIso,
  formatExpirationDate,
  formatDateTime,
  statusTone,
  useStepFlow,
  type ExternalRecipientDraft,
  type InternalCandidate,
  type RecipientAudience,
} from '@/features/documents/recipients/RecipientFlow';
import { CrossTenantRecipientField } from '@/features/directory/components/CrossTenantRecipientField';
import { useShareableUsersSearch } from '@/features/sharing/hooks/useShareDocumentMutations';
import {
  cancelDocumentSignatureRequest,
  createDocumentSignatureRequest,
  fetchDocumentSignatureRequests,
} from './api/signatureApi';
import { invalidateSignatureQueries } from './utils/invalidateSignatureQueries';

const STEPS = ['Quem assina', 'Condições', 'Confirmar'];
const INVALID_PHONE_MESSAGE = 'Informe um telefone válido com DDI, por exemplo +55 54 99999-9999.';

type RequestSignatureModalProps = {
  open: boolean;
  document: DocumentListItem | null;
  onClose: () => void;
  /** Avisa a tela de origem para recarregar a lista depois de criar a solicitação. */
  onCreated?: () => void;
};

function requestStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'aguardando';
    case 'partially_signed':
      return 'parcial';
    case 'signed':
      return 'assinado';
    case 'declined':
      return 'recusado';
    case 'expired':
      return 'expirado';
    case 'cancelled':
      return 'cancelado';
    default:
      return status;
  }
}

export function RequestSignatureModal({
  open,
  document,
  onClose,
  onCreated,
}: RequestSignatureModalProps) {
  const documentId = document?.id ?? null;
  const queryClient = useQueryClient();
  const flow = useStepFlow(STEPS.length, open);

  const [audience, setAudience] = useState<RecipientAudience>('internal');
  const [query, setQuery] = useState('');
  const [internalPick, setInternalPick] = useState<InternalCandidate | null>(null);
  /**
   * Signatário de outra empresa DOQYN.
   *
   * Fora de `internalPick` porque não é membro daqui: não tem id de associação, e o pedido sai
   * com o e-mail, que é o que o servidor resolve contra o diretório.
   */
  const [crossTenantSigner, setCrossTenantSigner] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [external, setExternal] = useState<ExternalRecipientDraft>(EMPTY_EXTERNAL_RECIPIENT);
  const [expiresAt, setExpiresAt] = useState(() => defaultExpirationDate(7));
  const [canDownloadAfterSign, setCanDownloadAfterSign] = useState(false);
  const [message, setMessage] = useState('');
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [internalDone, setInternalDone] = useState(false);

  const candidates = useShareableUsersSearch(documentId, query);

  const requests = useQuery({
    queryKey: ['document-signature-requests', documentId],
    queryFn: () => fetchDocumentSignatureRequests(documentId!),
    enabled: Boolean(open && documentId),
    staleTime: 10_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['document-signature-requests', documentId],
    });
    await invalidateSignatureQueries(queryClient);
  };

  const createRequest = useMutation({
    mutationFn: () =>
      createDocumentSignatureRequest(documentId!, {
        signerType: audience === 'internal' ? 'internal_user' : 'external_guest',
        signerUserId:
          audience === 'internal' && !crossTenantSigner
            ? (internalPick?.id ?? undefined)
            : undefined,
        signerName: audience === 'external' ? external.name.trim() : undefined,
        // Assinante de outra empresa viaja pelo e-mail: é ele que o servidor resolve no diretório.
        signerEmail:
          audience === 'external' ? external.email.trim() : (crossTenantSigner?.email ?? undefined),
        signerPhone: audience === 'external' ? external.phone.trim() || undefined : undefined,
        signerOrganizationName:
          audience === 'external' ? external.organizationName.trim() || undefined : undefined,
        message: message.trim() || undefined,
        expiresAt: expirationDateToIso(expiresAt),
        permissions: { canDownloadAfterSign },
      }),
    onError: (error) => showApiErrorToast(error, 'Não foi possível criar a solicitação.'),
    onSettled: invalidate,
  });

  const cancelRequest = useMutation({
    mutationFn: (signatureRequestId: string) =>
      cancelDocumentSignatureRequest(documentId!, signatureRequestId),
    onSuccess: () =>
      showAppToast({
        type: 'success',
        title: 'Solicitação cancelada',
        message: 'O signatário perdeu o acesso.',
      }),
    onError: (error) => showApiErrorToast(error, 'Não foi possível cancelar a solicitação.'),
    onSettled: invalidate,
  });

  useEffect(() => {
    if (open) return;
    setAudience('internal');
    setQuery('');
    setInternalPick(null);
    setCrossTenantSigner(null);
    setExternal(EMPTY_EXTERNAL_RECIPIENT);
    setExpiresAt(defaultExpirationDate(7));
    setCanDownloadAfterSign(false);
    setMessage('');
    setIssuedUrl(null);
    setInternalDone(false);
  }, [open]);

  const phoneError =
    external.phone && !isCompleteWhatsapp(external.phone) ? INVALID_PHONE_MESSAGE : undefined;

  const canAdvance = useMemo(() => {
    if (flow.step === 0) {
      if (audience === 'internal') return Boolean(internalPick ?? crossTenantSigner);
      return external.name.trim().length > 0 && external.email.trim().includes('@') && !phoneError;
    }
    if (flow.step === 1) return Boolean(expiresAt);
    return true;
  }, [
    audience,
    crossTenantSigner,
    expiresAt,
    external.email,
    external.name,
    flow.step,
    internalPick,
    phoneError,
  ]);

  const handleSubmit = async () => {
    if (!documentId) return;
    const result = (await createRequest.mutateAsync()) as {
      request?: { portalUrl?: string | null };
    };
    onCreated?.();
    const portalUrl = result.request?.portalUrl ?? null;
    if (audience === 'external' && portalUrl) {
      setIssuedUrl(portalUrl);
      return;
    }
    setInternalDone(true);
  };

  const accessRows = (requests.data?.items ?? []).map((request) => {
    const signer = request.signers[0];
    const portalUrl = (request as { portalUrl?: string | null }).portalUrl ?? null;
    const open = request.status === 'pending' || request.status === 'partially_signed';
    return {
      id: request.signatureRequestId,
      primary: signer?.name ?? 'Signatário',
      secondary: `${signer?.emailMasked ?? '—'} · pedido em ${formatDateTime(request.createdAt)}${
        request.expiresAt ? ` · expira ${formatDateTime(request.expiresAt)}` : ''
      }`,
      status: { label: requestStatusLabel(request.status), tone: statusTone(request.status) },
      actions: [
        ...(portalUrl && open
          ? [
              {
                label: 'Copiar link',
                onClick: () => void navigator.clipboard.writeText(portalUrl),
              },
            ]
          : []),
        ...(open
          ? [
              {
                label: 'Cancelar',
                tone: 'danger' as const,
                disabled: cancelRequest.isPending,
                onClick: () => cancelRequest.mutate(request.signatureRequestId),
              },
            ]
          : []),
      ],
    };
  });

  if (!document) return null;

  const recipientLabel =
    audience === 'internal'
      ? (crossTenantSigner?.name ?? internalPick?.name ?? '—')
      : external.name.trim() || external.email.trim() || '—';

  const finished = issuedUrl !== null || internalDone;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Solicitar assinatura"
      size="lg"
      dismissOnOverlay={false}
      subtitle={
        <span className="block truncate">
          {document.currentFileName || document.displayName}
          {document.categoryName ? ` · ${document.categoryName}` : ''}
          {document.versionLabel ? ` · ${document.versionLabel}` : ''}
        </span>
      }
      toolbar={
        finished ? undefined : (
          <StepTrack steps={STEPS} current={flow.step} onSelect={flow.setStep} />
        )
      }
      footer={
        finished ? null : (
          <FlowFooter
            step={flow.step}
            stepCount={STEPS.length}
            canAdvance={canAdvance}
            submitting={createRequest.isPending}
            submitLabel="Criar solicitação"
            onBack={flow.back}
            onNext={flow.next}
            onSubmit={() => void handleSubmit()}
            onCancel={onClose}
          />
        )
      }
    >
      {finished ? (
        <div className="flex flex-col gap-5">
          {issuedUrl ? (
            <>
              <IssuedLink url={issuedUrl} label="Link do portal de assinatura" />
              <p className="type-caption text-doqyn-muted">
                Vale até {formatExpirationDate(expiresAt)}. Enquanto a solicitação estiver aberta,
                este link pode ser copiado de novo na lista abaixo.
              </p>
            </>
          ) : (
            <p className="type-body text-doqyn-text">
              {recipientLabel} recebeu a solicitação e vê o documento em “Para assinar”.
            </p>
          )}
          <AccessList
            title="Assinaturas deste documento"
            emptyLabel="Nenhuma solicitação ainda."
            rows={accessRows}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {flow.step === 0 ? (
            <div className="flex flex-col gap-5">
              <AudiencePicker
                value={audience}
                onChange={setAudience}
                internalLabel="Usuário DOQYN"
                externalLabel="Convidado externo"
              />
              {audience === 'internal' ? (
                <InternalRecipientPicker
                  query={query}
                  onQueryChange={setQuery}
                  loading={candidates.isLoading}
                  candidates={(candidates.data ?? []).map((user) => ({
                    id: user.userId,
                    name: user.name,
                    email: user.email ?? '',
                  }))}
                  selected={internalPick}
                  onSelect={setInternalPick}
                  emptyLabel="Ninguém encontrado com esse nome ou e-mail."
                  emptyAction={
                    <div className="flex flex-col gap-3">
                      <p className="text-eyebrow uppercase text-doqyn-subtle">De outra empresa</p>
                      {/* Assinar é o verbo menos disruptivo dos que saem da empresa: quem assina de
                          fora abre a página própria com token e não entra no acervo. Por isso aqui
                          não há aceite a esperar. */}
                      <CrossTenantRecipientField
                        label="E-mail de quem vai assinar"
                        idleHint="Digite o e-mail completo de alguém de outra empresa. Ela assina pela página própria, sem entrar no seu acervo."
                        onPick={setCrossTenantSigner}
                        onFallbackToLink={(email) => {
                          setAudience('external');
                          setExternal({ ...EMPTY_EXTERNAL_RECIPIENT, email });
                        }}
                        fallbackLabel="Convidar por link"
                      />
                    </div>
                  }
                />
              ) : (
                <ExternalRecipientFields
                  value={external}
                  onChange={setExternal}
                  requireName
                  phoneError={phoneError}
                />
              )}
              <AccessList
                title="Assinaturas deste documento"
                emptyLabel="Nenhuma solicitação ainda."
                rows={accessRows}
              />
            </div>
          ) : null}

          {flow.step === 1 ? (
            <ConditionsStep
              expiresAt={expiresAt}
              onExpiresAtChange={setExpiresAt}
              expiresHint="Passado o prazo, a solicitação expira e o documento não pode mais ser assinado por ela."
              toggles={[
                {
                  id: 'download-after-sign',
                  label: 'Permitir baixar o PDF assinado',
                  description: 'Quem assinou pode guardar uma cópia com o carimbo de assinatura.',
                  checked: canDownloadAfterSign,
                  onChange: setCanDownloadAfterSign,
                },
              ]}
              message={message}
              onMessageChange={setMessage}
              messagePlaceholder="O que a pessoa precisa saber antes de assinar."
            />
          ) : null}

          {flow.step === 2 ? (
            <SummaryStep
              rows={[
                { label: 'Documento', value: document.currentFileName || document.displayName },
                {
                  label: 'Quem assina',
                  value:
                    audience === 'internal'
                      ? `${recipientLabel} (da empresa)`
                      : `${recipientLabel} (convidado externo)`,
                },
                { label: 'Baixar após assinar', value: canDownloadAfterSign ? 'Sim' : 'Não' },
                { label: 'Válido até', value: formatExpirationDate(expiresAt) },
                { label: 'Mensagem', value: message.trim() || '—' },
              ]}
              note={
                audience === 'external'
                  ? 'O link do portal é gerado agora e fica disponível para copiar enquanto a solicitação estiver aberta.'
                  : 'A pessoa passa a ver o documento em “Para assinar”.'
              }
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}
