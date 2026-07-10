import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ExternalInviteLinkField } from '@/components/ui/ExternalInviteLinkField';
import { Input } from '@/components/ui/Input';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { isCompleteWhatsapp } from '@/lib/identifiers';
import type { DocumentListItem } from '@/types/document-library';
import { useShareableUsersSearch } from '@/features/sharing/hooks/useShareDocumentMutations';
import type { ShareableUser } from '@/features/sharing/api/shareApi';
import { createDocumentSignatureRequest } from '@/features/signature/api/signatureApi';
import { invalidateSignatureQueries } from '@/features/signature/utils/invalidateSignatureQueries';

type SignatureTab = 'internal' | 'external';

const INVALID_EXTERNAL_PHONE_MESSAGE =
  'Informe um telefone válido com DDI, por exemplo +55 54 99999-9999.';

type RequestSignatureModalProps = {
  open: boolean;
  document: DocumentListItem | null;
  onClose: () => void;
  onCreated?: () => void;
};

function defaultExpirationIso(days = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 16);
}

export function RequestSignatureModal({
  open,
  document,
  onClose,
  onCreated,
}: RequestSignatureModalProps) {
  const queryClient = useQueryClient();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<SignatureTab>('internal');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ShareableUser | null>(null);
  const [internalMessage, setInternalMessage] = useState('');
  const [internalExpiresAt, setInternalExpiresAt] = useState(defaultExpirationIso());
  const [externalName, setExternalName] = useState('');
  const [externalEmail, setExternalEmail] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [externalPhoneError, setExternalPhoneError] = useState<string | null>(null);
  const [externalOrganization, setExternalOrganization] = useState('');
  const [externalMessage, setExternalMessage] = useState('');
  const [externalExpiresAt, setExternalExpiresAt] = useState(defaultExpirationIso());
  const [externalAllowDownload, setExternalAllowDownload] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [internalSuccess, setInternalSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const documentId = document?.documentId ?? null;
  const usersQuery = useShareableUsersSearch(documentId, search);

  const availableUsers = useMemo(
    () => usersQuery.data ?? [],
    [usersQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setTab('internal');
      setSearch('');
      setSelectedUser(null);
      setInternalMessage('');
      setInternalExpiresAt(defaultExpirationIso());
      setExternalName('');
      setExternalEmail('');
      setExternalPhone('');
      setExternalPhoneError(null);
      setExternalOrganization('');
      setExternalMessage('');
      setExternalExpiresAt(defaultExpirationIso());
      setExternalAllowDownload(false);
      setPortalUrl(null);
      setInternalSuccess(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !document) return null;

  const handleInternalSubmit = async () => {
    if (!documentId || !selectedUser) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDocumentSignatureRequest(documentId, {
        signerType: 'internal_user',
        signerUserId: selectedUser.userId,
        message: internalMessage.trim() || undefined,
        expiresAt: new Date(internalExpiresAt).toISOString(),
      });
      setInternalSuccess(true);
      await invalidateSignatureQueries(queryClient);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExternalSubmit = async () => {
    if (!documentId || !externalName.trim() || !externalEmail.trim()) return;

    if (externalPhone.trim() && !isCompleteWhatsapp(externalPhone)) {
      setExternalPhoneError(INVALID_EXTERNAL_PHONE_MESSAGE);
      return;
    }
    setExternalPhoneError(null);

    setSubmitting(true);
    setError(null);
    try {
      const result = (await createDocumentSignatureRequest(documentId, {
        signerType: 'external_guest',
        signerName: externalName.trim(),
        signerEmail: externalEmail.trim(),
        signerPhone: externalPhone.trim() || undefined,
        signerOrganizationName: externalOrganization.trim() || undefined,
        message: externalMessage.trim() || undefined,
        expiresAt: new Date(externalExpiresAt).toISOString(),
        permissions: { canDownloadAfterSign: externalAllowDownload },
      })) as { request?: { portalUrl?: string } };
      setPortalUrl(result.request?.portalUrl ?? null);
      await invalidateSignatureQueries(queryClient);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center modal-overlay-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-signature-modal-title"
      data-testid="request-signature-modal"
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-doqyn-border bg-doqyn-surface shadow-xl">
        <div className="border-b border-doqyn-border-subtle px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="request-signature-modal-title" className="text-base font-semibold text-doqyn-text">
                Solicitar assinatura
              </h2>
              <p className="mt-1 truncate text-[13px] font-medium text-doqyn-text">
                {document.currentFileName ?? document.displayName}
              </p>
              <p className="mt-0.5 text-[12px] text-doqyn-subtle">
                {document.categoryName ?? '—'}
                {document.versionLabel ? ` · ${document.versionLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-doqyn-muted hover:text-doqyn-text"
              aria-label="Fechar"
            >
              <Icon name="close" size={ICON_SIZE.md} />
            </button>
          </div>

          <div className="mt-4 flex gap-2" data-testid="request-signature-tabs">
            <button
              type="button"
              onClick={() => setTab('internal')}
              className={[
                'rounded-lg px-3 py-1.5 text-[12px] font-medium',
                tab === 'internal'
                  ? 'bg-doqyn-accent/12 text-doqyn-accent'
                  : 'text-doqyn-subtle hover:bg-doqyn-surface-hover',
              ].join(' ')}
              data-testid="request-signature-tab-internal"
            >
              Pessoas da empresa
            </button>
            <button
              type="button"
              onClick={() => setTab('external')}
              className={[
                'rounded-lg px-3 py-1.5 text-[12px] font-medium',
                tab === 'external'
                  ? 'bg-doqyn-accent/12 text-doqyn-accent'
                  : 'text-doqyn-subtle hover:bg-doqyn-surface-hover',
              ].join(' ')}
              data-testid="request-signature-tab-external"
            >
              Convidados externos
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {tab === 'internal' ? (
            internalSuccess ? (
              <div className="space-y-3 text-sm" data-testid="request-signature-internal-success">
                <p>Solicitação enviada. O signatário verá em &quot;Para assinar&quot;.</p>
                <Button type="button" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar usuário por nome ou e-mail…"
                    aria-label="Buscar usuário"
                  />
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {usersQuery.isLoading ? (
                      <p className="text-[12px] text-doqyn-subtle">Buscando usuários…</p>
                    ) : availableUsers.length === 0 ? (
                      <p className="text-[12px] text-doqyn-subtle">
                        {search.trim() ? 'Nenhum usuário encontrado.' : 'Digite para buscar usuários ativos.'}
                      </p>
                    ) : (
                      availableUsers.map((user) => {
                        const isSelected = selectedUser?.userId === user.userId;
                        return (
                          <button
                            key={user.userId}
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className={[
                              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left',
                              isSelected
                                ? 'border-doqyn-accent/40 bg-doqyn-accent/8'
                                : 'border-transparent hover:border-doqyn-border-subtle hover:bg-doqyn-surface-hover',
                            ].join(' ')}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-doqyn-surface-raised text-[11px] font-semibold text-doqyn-muted">
                              {(user.name || user.email || '?').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-doqyn-text">
                                {user.name}
                              </span>
                              {user.email ? (
                                <span className="block truncate text-[11px] text-doqyn-subtle">
                                  {user.email}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] text-doqyn-subtle">Expira em</label>
                  <Input
                    type="datetime-local"
                    value={internalExpiresAt}
                    onChange={(event) => setInternalExpiresAt(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[12px] text-doqyn-subtle">Mensagem (opcional)</label>
                  <textarea
                    className="w-full rounded-lg border border-doqyn-border bg-doqyn-bg px-3 py-2 text-sm"
                    rows={3}
                    value={internalMessage}
                    onChange={(event) => setInternalMessage(event.target.value)}
                  />
                </div>
              </>
            )
          ) : portalUrl ? (
            <div className="space-y-3" data-testid="request-signature-external-success">
              <ExternalInviteLinkField
                value={portalUrl}
                intro="Solicitação criada. Compartilhe o link abaixo com o signatário."
                testId="request-signature-portal-url"
              />
              <Button type="button" onClick={onClose}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <Input
                value={externalName}
                onChange={(event) => setExternalName(event.target.value)}
                placeholder="Nome do signatário"
                aria-label="Nome do signatário"
              />
              <Input
                type="email"
                value={externalEmail}
                onChange={(event) => setExternalEmail(event.target.value)}
                placeholder="E-mail"
                aria-label="E-mail do signatário"
              />
              <WhatsappInput
                value={externalPhone}
                onChange={(value) => {
                  setExternalPhone(value);
                  if (externalPhoneError) setExternalPhoneError(null);
                }}
                error={externalPhoneError ?? undefined}
              />
              <Input
                value={externalOrganization}
                onChange={(event) => setExternalOrganization(event.target.value)}
                placeholder="Organização (opcional)"
                aria-label="Organização"
              />
              <div>
                <label className="mb-1 block text-[12px] text-doqyn-subtle">Expira em</label>
                <Input
                  type="datetime-local"
                  value={externalExpiresAt}
                  onChange={(event) => setExternalExpiresAt(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-doqyn-subtle">Mensagem (opcional)</label>
                <textarea
                  className="w-full rounded-lg border border-doqyn-border bg-doqyn-bg px-3 py-2 text-sm"
                  rows={3}
                  value={externalMessage}
                  onChange={(event) => setExternalMessage(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-[13px] text-doqyn-text">
                <input
                  type="checkbox"
                  checked={externalAllowDownload}
                  onChange={(event) => setExternalAllowDownload(event.target.checked)}
                  className="rounded border-doqyn-border"
                />
                Permitir baixar PDF assinado
              </label>
            </>
          )}

          {error ? <p className="text-sm text-doqyn-danger">{error}</p> : null}
        </div>

        {!portalUrl && !internalSuccess ? (
          <div className="flex justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            {tab === 'internal' ? (
              <Button
                type="button"
                disabled={submitting || !selectedUser}
                onClick={() => void handleInternalSubmit()}
                data-testid="request-signature-submit-internal"
              >
                {submitting ? 'Criando…' : 'Criar solicitação'}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitting || !externalName.trim() || !externalEmail.trim()}
                onClick={() => void handleExternalSubmit()}
                data-testid="request-signature-submit-external"
              >
                {submitting ? 'Criando…' : 'Criar solicitação'}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
