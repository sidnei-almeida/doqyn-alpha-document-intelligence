import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { isCompleteWhatsapp } from '@/lib/identifiers';
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
import {
  useDocumentShares,
  useShareableUsersSearch,
  useShareDocumentMutations,
} from '../hooks/useShareDocumentMutations';
import {
  useDocumentExternalShares,
  useExternalShareMutations,
} from '../hooks/useExternalShareMutations';

const STEPS = ['Quem recebe', 'Condições', 'Confirmar'];
const INVALID_PHONE_MESSAGE = 'Informe um telefone válido com DDI, por exemplo +55 54 99999-9999.';

type ShareDocumentModalProps = {
  open: boolean;
  document: DocumentListItem | null;
  onClose: () => void;
};

function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'ativo';
    case 'pending':
      return 'pendente';
    case 'revoked':
      return 'revogado';
    case 'expired':
      return 'expirado';
    default:
      return status;
  }
}

export function ShareDocumentModal({ open, document, onClose }: ShareDocumentModalProps) {
  const documentId = document?.id ?? null;
  const flow = useStepFlow(STEPS.length, open);

  const [audience, setAudience] = useState<RecipientAudience>('internal');
  const [query, setQuery] = useState('');
  const [internalPick, setInternalPick] = useState<InternalCandidate | null>(null);
  const [external, setExternal] = useState<ExternalRecipientDraft>(EMPTY_EXTERNAL_RECIPIENT);
  /**
   * Destinatário de outra empresa DOQYN.
   *
   * Vive fora de `internalPick` porque não é membro daqui: não tem id de associação, não aparece na
   * busca por nome, e o envio para ele nasce pendente do outro lado. Tratá-lo como membro faria a
   * tela prometer um acesso imediato que não acontece.
   */
  const [crossTenantPick, setCrossTenantPick] = useState<{
    email?: string;
    username?: string;
    name: string;
  } | null>(null);
  const [expiresAt, setExpiresAt] = useState(() => defaultExpirationDate(7));
  const [canDownload, setCanDownload] = useState(false);
  const [message, setMessage] = useState('');
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const internalShares = useDocumentShares(documentId, open);
  const externalShares = useDocumentExternalShares(documentId, open);
  const candidates = useShareableUsersSearch(documentId, query);
  const { shareWithUser, revokeShare } = useShareDocumentMutations(documentId);
  const { createExternalShare, revokeExternalShare, regenerateExternalShare } =
    useExternalShareMutations(documentId);

  useEffect(() => {
    if (open) return;
    setAudience('internal');
    setQuery('');
    setInternalPick(null);
    setCrossTenantPick(null);
    setExternal(EMPTY_EXTERNAL_RECIPIENT);
    setExpiresAt(defaultExpirationDate(7));
    setCanDownload(false);
    setMessage('');
    setIssuedUrl(null);
  }, [open]);

  const phoneError =
    external.phone && !isCompleteWhatsapp(external.phone) ? INVALID_PHONE_MESSAGE : undefined;

  const canAdvance = useMemo(() => {
    if (flow.step === 0) {
      if (audience === 'internal') return Boolean(internalPick ?? crossTenantPick);
      return external.email.trim().includes('@') && !phoneError;
    }
    // O prazo é obrigatório para tudo que sai da empresa — com conta DOQYN ou sem. O acesso
    // concedido não é reavaliado depois, e a validade é o único mecanismo que o fecha sozinho.
    if (flow.step === 1) return (audience === 'internal' && !crossTenantPick) || Boolean(expiresAt);
    return true;
  }, [audience, crossTenantPick, expiresAt, external.email, flow.step, internalPick, phoneError]);

  const submitting = shareWithUser.isPending || createExternalShare.isPending;

  const handleSubmit = async () => {
    if (!documentId) return;

    if (audience === 'internal' && crossTenantPick) {
      await shareWithUser.mutateAsync({
        sharedWithEmail: crossTenantPick.email,
        sharedWithUsername: crossTenantPick.username,
        canDownload,
        message: message.trim() || undefined,
        expiresAt: expirationDateToIso(expiresAt),
      });
      onClose();
      return;
    }

    if (audience === 'internal' && internalPick) {
      await shareWithUser.mutateAsync({
        sharedWithUserId: internalPick.id,
        canDownload,
        message: message.trim() || undefined,
      });
      onClose();
      return;
    }

    const result = await createExternalShare.mutateAsync({
      recipientEmail: external.email.trim(),
      recipientPhone: external.phone.trim() || undefined,
      recipientName: external.name.trim() || undefined,
      recipientOrganizationName: external.organizationName.trim() || undefined,
      canDownload,
      expiresAt: expirationDateToIso(expiresAt),
      message: message.trim() || undefined,
    });
    setIssuedUrl(result.inviteUrl);
  };

  const accessRows = [
    ...(internalShares.data?.shares ?? []).map((share) => ({
      id: share.shareId,
      primary: share.sharedWithName,
      secondary: `${share.sharedWithEmail ?? share.counterpartTenantName ?? '—'} · ${share.permissions.canDownload ? 'pode baixar' : 'só leitura'}`,
      // Oferecido não é concedido: dizer "da empresa" para o que ainda espera aceite prometeria um
      // acesso que não existe.
      status:
        share.inboundStatus === 'pending'
          ? { label: 'aguardando aceite', tone: 'pending' as const }
          : share.inboundStatus === 'declined'
            ? { label: 'recusado', tone: 'closed' as const }
            : share.inboundStatus === 'accepted'
              ? { label: 'outra empresa', tone: 'active' as const }
              : { label: 'da empresa', tone: 'active' as const },
      actions: [
        {
          label: 'Revogar',
          tone: 'danger' as const,
          disabled: revokeShare.isPending,
          onClick: () => revokeShare.mutate(share.shareId),
        },
      ],
    })),
    ...(externalShares.data?.shares ?? []).map((share) => ({
      id: share.shareId,
      primary: share.recipientName?.trim() || share.recipientEmail,
      secondary: `${share.recipientEmail} · expira ${formatDateTime(share.expiresAt)} · ${
        share.permissions.canDownload ? 'pode baixar' : 'só leitura'
      }`,
      status: { label: statusLabel(share.status), tone: statusTone(share.status) },
      actions: [
        ...(share.inviteUrl
          ? [
              {
                label: 'Copiar link',
                onClick: () => void navigator.clipboard.writeText(share.inviteUrl!),
              },
            ]
          : []),
        {
          label: 'Novo link',
          disabled: regenerateExternalShare.isPending,
          onClick: () =>
            regenerateExternalShare.mutate(share.shareId, {
              onSuccess: (result) => setIssuedUrl(result.inviteUrl),
            }),
        },
        {
          label: 'Revogar',
          tone: 'danger' as const,
          disabled: revokeExternalShare.isPending || share.status === 'revoked',
          onClick: () => revokeExternalShare.mutate(share.shareId),
        },
      ],
    })),
  ];

  if (!document) return null;

  const recipientLabel =
    audience === 'internal'
      ? (internalPick?.name ?? '—')
      : external.name.trim() || external.email.trim() || '—';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compartilhar documento"
      size="lg"
      dismissOnOverlay={false}
      subtitle={
        <span className="block truncate">
          {document.currentFileName || document.displayName}
          {document.categoryName ? ` · ${document.categoryName}` : ''}
          {document.versionLabel ? ` · ${document.versionLabel}` : ''}
        </span>
      }
      toolbar={<StepTrack steps={STEPS} current={flow.step} onSelect={flow.setStep} />}
      footer={
        issuedUrl ? null : (
          <FlowFooter
            step={flow.step}
            stepCount={STEPS.length}
            canAdvance={canAdvance}
            submitting={submitting}
            submitLabel="Compartilhar"
            onBack={flow.back}
            onNext={flow.next}
            onSubmit={() => void handleSubmit()}
            onCancel={onClose}
          />
        )
      }
    >
      {issuedUrl ? (
        <div className="flex flex-col gap-5">
          <IssuedLink url={issuedUrl} />
          <p className="type-caption text-doqyn-muted">
            O convite vale até {formatExpirationDate(expiresAt)}. Enquanto o acesso existir, este
            link pode ser copiado de novo aqui na lista.
          </p>
          <AccessList title="Quem tem acesso" emptyLabel="Ninguém ainda." rows={accessRows} />
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
              {audience === 'internal' && crossTenantPick ? (
                <div className="recipient-chosen">
                  <div className="min-w-0">
                    <p className="type-body truncate text-doqyn-text">{crossTenantPick.name}</p>
                    <p className="type-caption truncate text-doqyn-muted">
                      {crossTenantPick.email ?? `@${crossTenantPick.username}`} · de outra empresa
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCrossTenantPick(null)}
                  >
                    Trocar
                  </Button>
                </div>
              ) : audience === 'internal' ? (
                <InternalRecipientPicker
                  query={query}
                  onQueryChange={setQuery}
                  loading={candidates.isLoading}
                  candidates={(candidates.data ?? [])
                    .filter((user) => !user.alreadyShared)
                    .map((user) => ({
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
                      {/* Campo próprio, e sempre visível. A busca de cima procura por nome numa
                          lista conhecida; esta resolve um e-mail exato contra o diretório, porque
                          o nome de quem está fora é guardado cifrado. Escondê-la atrás do "ninguém
                          encontrado" exigia saber de antemão que o destinatário está fora, que é
                          justamente o que se quer descobrir. */}
                      <CrossTenantRecipientField
                        onPick={setCrossTenantPick}
                        onFallbackToLink={(email) => {
                          setAudience('external');
                          setExternal({ ...EMPTY_EXTERNAL_RECIPIENT, email });
                        }}
                        fallbackLabel="Enviar por link com prazo"
                      />
                    </div>
                  }
                />
              ) : (
                <ExternalRecipientFields
                  value={external}
                  onChange={setExternal}
                  requireName={false}
                  phoneError={phoneError}
                />
              )}
              <AccessList title="Quem tem acesso" emptyLabel="Ninguém ainda." rows={accessRows} />
            </div>
          ) : null}

          {flow.step === 1 ? (
            <ConditionsStep
              expiresAt={expiresAt}
              onExpiresAtChange={setExpiresAt}
              expiresHint={
                crossTenantPick
                  ? 'Fora da empresa o acesso tem prazo: passado ele, a concessão fecha sozinha.'
                  : audience === 'internal'
                    ? 'Acesso de quem é da empresa não expira: vale enquanto não for revogado.'
                    : 'Passado o prazo, o link para de abrir sozinho.'
              }
              toggles={[
                {
                  id: 'download',
                  label: 'Permitir baixar o arquivo',
                  description: 'Sem isto, o documento só pode ser lido na tela.',
                  checked: canDownload,
                  onChange: setCanDownload,
                },
              ]}
              message={message}
              onMessageChange={setMessage}
              messagePlaceholder="Contexto para quem vai receber."
            />
          ) : null}

          {flow.step === 2 ? (
            <SummaryStep
              rows={[
                { label: 'Documento', value: document.currentFileName || document.displayName },
                {
                  label: 'Quem recebe',
                  value: crossTenantPick
                    ? `${crossTenantPick.name} (outra empresa DOQYN)`
                    : audience === 'internal'
                      ? `${recipientLabel} (da empresa)`
                      : `${recipientLabel} (convidado externo)`,
                },
                { label: 'Pode baixar', value: canDownload ? 'Sim' : 'Não' },
                {
                  label: 'Válido até',
                  value: audience === 'internal' ? 'Sem prazo' : formatExpirationDate(expiresAt),
                },
                { label: 'Mensagem', value: message.trim() || '—' },
              ]}
              note={
                audience === 'external'
                  ? 'O link é gerado agora e fica disponível para copiar enquanto o acesso existir.'
                  : 'A pessoa passa a ver o documento na Biblioteca dela.'
              }
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}
