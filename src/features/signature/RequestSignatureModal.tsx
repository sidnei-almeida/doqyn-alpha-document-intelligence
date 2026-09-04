import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { isCompleteWhatsapp } from '@/lib/identifiers';
import { isIndividualTenant } from '@/lib/tenantVocabulary';
import { useAuth } from '@/auth/useAuth';
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
  describeRecipient,
  expirationDateToIso,
  formatExpirationDate,
  formatDateTime,
  resolveRecipient,
  statusTone,
  useStepFlow,
  type CrossTenantCandidate,
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
  /**
   * Quem já vem escolhido, quando o envio começou por uma pessoa.
   *
   * A tela de Contatos parte de alguém e só depois pergunta qual documento; sem isto, ela
   * entregaria o modal pedindo para achar de novo a pessoa em que se acabou de clicar.
   *
   * Aplicado só na abertura: reaplicar desfaria a troca de destinatário feita aqui dentro.
   */
  initialRecipient?: InternalCandidate | null;
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
  initialRecipient,
  onClose,
  onCreated,
}: RequestSignatureModalProps) {
  const documentId = document?.id ?? null;
  const queryClient = useQueryClient();
  const flow = useStepFlow(STEPS.length, open);
  const { tenant } = useAuth();
  /**
   * Em PF não há colega para assinar: o tenant tem um usuário só, e pedir assinatura a si mesmo
   * não é o caso de uso. A aba interna some e o fluxo abre no convite externo.
   */
  const hasInternalAudience = !isIndividualTenant(tenant?.tenantType);
  const defaultAudience: RecipientAudience = hasInternalAudience ? 'internal' : 'external';

  const [audience, setAudience] = useState<RecipientAudience>(defaultAudience);
  const [query, setQuery] = useState('');
  const [internalPick, setInternalPick] = useState<InternalCandidate | null>(null);
  /**
   * Signatário de outra empresa DOQYN.
   *
   * Fora de `internalPick` porque não é membro daqui: não tem id de associação, e o pedido sai
   * com o e-mail, que é o que o servidor resolve contra o diretório.
   */
  const [crossTenantSigner, setCrossTenantSigner] = useState<CrossTenantCandidate | null>(null);
  const [external, setExternal] = useState<ExternalRecipientDraft>(EMPTY_EXTERNAL_RECIPIENT);
  const [expiresAt, setExpiresAt] = useState(() => defaultExpirationDate(7));
  const [canDownloadAfterSign, setCanDownloadAfterSign] = useState(false);
  const [message, setMessage] = useState('');
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [internalDone, setInternalDone] = useState(false);

  /** Quem assina, pela aba e por mais nada — ver `resolveRecipient`. */
  const recipient = useMemo(
    () =>
      resolveRecipient(audience, { internal: internalPick, doqyn: crossTenantSigner, external }),
    [audience, crossTenantSigner, external, internalPick],
  );

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
        /**
         * `external_guest` é só para quem **não tem conta** — e não para todo mundo que está fora.
         *
         * Quem tem conta DOQYN em outra empresa entra por `internal_user`: é esse ramo que resolve
         * o contato contra o diretório (`signatureRecipientValidation.ts`, `resolveSignerByEmail`)
         * e emite o token de portal quando a pessoa é de fora. O ramo `external_guest` não resolve
         * nada — ele exige nome e e-mail digitados, e a aba "Outra empresa" não digita nome
         * nenhum, então todo pedido para outra empresa morria em `SIGNER_NAME_REQUIRED`.
         */
        signerType: recipient.external ? 'external_guest' : 'internal_user',
        signerUserId: recipient.internal?.id,
        signerName: recipient.external?.name.trim(),
        /**
         * Assinante de outra empresa viaja pelo contato: é ele que o servidor resolve no diretório.
         * O apelido serve tanto quanto o e-mail — a busca digitável nem sempre devolve endereço, e
         * `resolveSignerByEmail` aceita os dois (sem `@` vira busca por apelido).
         *
         * **Cada aba manda só o que é dela.** Escolher alguém de outra empresa pelo e-mail e
         * depois voltar para a aba de colegas deixava as duas escolhas vivas, e este campo caía
         * no `else` — o pedido saía com o id do colega **e** o e-mail do de fora. O servidor
         * prefere o e-mail (`documentSignatureService.ts`, resolução de `internal_user`), então a
         * solicitação nascia para a pessoa errada, com a tela anunciando a certa.
         */
        signerEmail:
          recipient.external?.email.trim() ?? recipient.doqyn?.email ?? recipient.doqyn?.username,
        signerPhone: recipient.external?.phone.trim() || undefined,
        signerOrganizationName: recipient.external?.organizationName.trim() || undefined,
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
    setAudience(defaultAudience);
    setQuery('');
    setInternalPick(null);
    setCrossTenantSigner(null);
    // ver o efeito de prefill abaixo
    setExternal(EMPTY_EXTERNAL_RECIPIENT);
    setExpiresAt(defaultExpirationDate(7));
    setCanDownloadAfterSign(false);
    setMessage('');
    setIssuedUrl(null);
    setInternalDone(false);
  }, [open, defaultAudience]);

  /** A sessão pode chegar depois da montagem — ver o mesmo guard em `ShareDocumentModal`. */
  useEffect(() => {
    if (!hasInternalAudience && audience === 'internal') setAudience(defaultAudience);
  }, [hasInternalAudience, audience, defaultAudience]);

  // Na abertura, quem já veio escolhido — ver `initialRecipient`. Depende só de `open` de
  // propósito: trocar de signatário aqui dentro não pode ser desfeito no render seguinte.
  useEffect(() => {
    if (!open || !initialRecipient) return;
    setAudience('internal');
    setInternalPick(initialRecipient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const phoneError =
    external.phone && !isCompleteWhatsapp(external.phone) ? INVALID_PHONE_MESSAGE : undefined;

  const canAdvance = useMemo(() => {
    if (flow.step === 0) {
      if (recipient.external) {
        const { name, email } = recipient.external;
        return name.trim().length > 0 && email.trim().includes('@') && !phoneError;
      }
      return Boolean(recipient.internal ?? recipient.doqyn);
    }
    if (flow.step === 1) return Boolean(expiresAt);
    return true;
  }, [expiresAt, flow.step, phoneError, recipient]);

  const handleSubmit = async () => {
    if (!documentId) return;
    const result = (await createRequest.mutateAsync()) as {
      request?: { portalUrl?: string | null };
    };
    onCreated?.();
    const portalUrl = result.request?.portalUrl ?? null;
    /**
     * Quem recebe token precisa ver o link, seja qual for a aba.
     *
     * "Para assinar" só lista o que está no tenant de quem abre a lista
     * (`listSignatureRequestsAssignedToMe` filtra por `tenantId`), então o signatário de outra
     * empresa nunca acha o pedido por lá — o link é o único caminho até o documento. O servidor
     * só emite token para quem está de fora: colega da casa não vem com `portalUrl`, e é por isso
     * que o link pode mandar aqui, em vez da aba.
     */
    if (portalUrl) {
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
              {recipient.label} recebeu a solicitação e vê o documento em “Para assinar”.
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
                internalLabel={hasInternalAudience ? 'Da sua empresa' : undefined}
                doqynLabel={hasInternalAudience ? 'Outra empresa' : 'Outra conta DOQYN'}
                externalLabel="Convidado externo"
              />
              {audience === 'doqyn' ? (
                /* Aba própria, e não um rodapé da busca de colegas — ver o mesmo comentário em
                   `ShareDocumentModal`. Assinar é o verbo menos disruptivo dos que saem da
                   empresa: quem assina de fora abre a página própria com token e não entra no
                   acervo, então aqui não há aceite a esperar. */
                <CrossTenantRecipientField
                  label="Nome de usuário de quem vai assinar"
                  idleHint="Quem tem conta DOQYN é achado pelo nome de usuário; o e-mail inteiro também resolve. Ela assina pela página própria, sem entrar no seu acervo."
                  onPick={setCrossTenantSigner}
                  onFallbackToLink={(email) => {
                    setAudience('external');
                    setExternal({ ...EMPTY_EXTERNAL_RECIPIENT, email });
                  }}
                  fallbackLabel="Convidar por link"
                />
              ) : audience === 'internal' ? (
                <InternalRecipientPicker
                  query={query}
                  onQueryChange={setQuery}
                  loading={candidates.isLoading}
                  candidates={(candidates.data ?? []).map((user) => ({
                    id: user.userId,
                    name: user.name,
                    email: user.email ?? '',
                    frequent: user.frequent,
                  }))}
                  selected={internalPick}
                  onSelect={setInternalPick}
                  emptyLabel="Ninguém encontrado com esse nome ou e-mail."
                  emptyAction={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAudience('doqyn')}
                    >
                      Não é da empresa? Buscar por nome de usuário
                    </Button>
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
                // Três origens, três rótulos: dizer "convidado externo" para uma conta DOQYN de
                // outra empresa nomeia certo a pessoa e errado o caminho dela.
                { label: 'Quem assina', value: describeRecipient(recipient) },
                { label: 'Baixar após assinar', value: canDownloadAfterSign ? 'Sim' : 'Não' },
                { label: 'Válido até', value: formatExpirationDate(expiresAt) },
                { label: 'Mensagem', value: message.trim() || '—' },
              ]}
              note={
                // "Para assinar" só lista o que está no tenant de quem abre a lista, então quem é
                // de outra empresa nunca acha o pedido por lá: o link é o caminho dela também.
                recipient.audience === 'internal'
                  ? 'A pessoa passa a ver o documento em “Para assinar”.'
                  : 'O link do portal é gerado agora e fica disponível para copiar enquanto a solicitação estiver aberta.'
              }
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}
