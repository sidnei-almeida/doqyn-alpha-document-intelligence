import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ExternalInviteLinkField } from '@/components/ui/ExternalInviteLinkField';
import { Input } from '@/components/ui/Input';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { Tooltip } from '@/components/ui/Tooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { isCompleteWhatsapp, WHATSAPP_PLACEHOLDER } from '@/lib/identifiers';
import type { DocumentListItem } from '@/types/document-library';
import {
  useDocumentShares,
  useShareableUsersSearch,
  useShareDocumentMutations,
} from '../hooks/useShareDocumentMutations';
import {
  useDocumentExternalShares,
  useExternalShareMutations,
} from '../hooks/useExternalShareMutations';
import type { ShareableUser } from '../api/shareApi';
import type { ExternalDocumentShareEntry } from '../api/externalShareApi';

type ShareTab = 'internal' | 'external';

const INVALID_EXTERNAL_PHONE_MESSAGE =
  'Informe um telefone válido com DDI, por exemplo +55 54 99999-9999.';

type ShareDocumentModalProps = {
  open: boolean;
  document: DocumentListItem | null;
  onClose: () => void;
};

function defaultExpirationIso(days = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 16);
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'pending':
      return 'Pendente';
    case 'revoked':
      return 'Revogado';
    case 'expired':
      return 'Expirado';
    default:
      return status;
  }
}

function canRevokeExternalShare(status: ExternalDocumentShareEntry['status']): boolean {
  return status === 'active' || status === 'pending';
}

function ExternalShareActionBadge({
  label,
  tooltip,
  tone = 'neutral',
  disabled,
  onClick,
  testId,
}: {
  label: string;
  tooltip: string;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-doqyn-danger/30 text-doqyn-danger hover:bg-doqyn-danger/10'
      : 'border-doqyn-border-subtle text-doqyn-subtle hover:bg-doqyn-surface-hover hover:text-doqyn-text';

  return (
    <Tooltip label={tooltip} placement="left">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
        className={[
          'rounded-full border px-2 py-0.5 text-micro font-medium leading-none transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          toneClass,
        ].join(' ')}
      >
        {label}
      </button>
    </Tooltip>
  );
}

function ExternalShareListItem({
  share,
  disabled,
  onRevoke,
  onRegenerate,
}: {
  share: ExternalDocumentShareEntry;
  disabled: boolean;
  onRevoke: (shareId: string) => void;
  onRegenerate: (shareId: string) => void;
}) {
  const showRevoke = canRevokeExternalShare(share.status);

  return (
    <div
      className="relative rounded-lg border border-doqyn-border-subtle px-3 py-2 pr-[4.75rem]"
      data-testid={`external-share-item-${share.shareId}`}
    >
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        {showRevoke ? (
          <ExternalShareActionBadge
            label="Revogar"
            tooltip="Revoga o acesso imediatamente. O link atual deixa de funcionar."
            tone="danger"
            disabled={disabled}
            onClick={() => onRevoke(share.shareId)}
            testId={`external-share-revoke-${share.shareId}`}
          />
        ) : null}
        <ExternalShareActionBadge
          label="Renovar"
          tooltip="Gera um novo link de convite. O link anterior deixa de funcionar e o destinatário precisará aceitar novamente."
          disabled={disabled}
          onClick={() => onRegenerate(share.shareId)}
          testId={`external-share-renew-${share.shareId}`}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-label text-doqyn-text">{share.recipientEmail}</p>
        <p className="text-micro text-doqyn-subtle">
          {share.recipientOrganizationName || 'Sem organização'}
          {' · '}
          {formatStatusLabel(share.status)}
          {share.expiresAt
            ? ` · expira ${new Date(share.expiresAt).toLocaleDateString('pt-BR')}`
            : ''}
        </p>
        <p className="text-micro text-doqyn-subtle">
          {share.permissions.canDownload ? 'Visualizar e baixar' : 'Somente visualizar'}
          {share.lastAccessAt
            ? ` · último acesso ${new Date(share.lastAccessAt).toLocaleString('pt-BR')}`
            : ''}
        </p>
        {share.recipientPhoneMasked ? (
          <p className="text-micro text-doqyn-subtle">{share.recipientPhoneMasked}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ShareDocumentModal({ open, document, onClose }: ShareDocumentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<ShareTab>('internal');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ShareableUser | null>(null);
  const [allowDownload, setAllowDownload] = useState(false);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [externalPhoneError, setExternalPhoneError] = useState<string | null>(null);
  const [externalName, setExternalName] = useState('');
  const [externalOrganization, setExternalOrganization] = useState('');
  const [externalAllowDownload, setExternalAllowDownload] = useState(false);
  const [externalExpiresAt, setExternalExpiresAt] = useState(defaultExpirationIso());
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const documentId = document?.documentId ?? null;
  const sharesQuery = useDocumentShares(documentId, open && tab === 'internal');
  const externalSharesQuery = useDocumentExternalShares(documentId, open && tab === 'external');
  const usersQuery = useShareableUsersSearch(documentId, search);
  const { shareWithUser, revokeShare } = useShareDocumentMutations(documentId);
  const { createExternalShare, revokeExternalShare, regenerateExternalShare } =
    useExternalShareMutations(documentId);

  const availableUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => !user.alreadyShared),
    [usersQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setTab('internal');
      setSearch('');
      setSelectedUser(null);
      setAllowDownload(false);
      setExternalEmail('');
      setExternalPhone('');
      setExternalPhoneError(null);
      setExternalName('');
      setExternalOrganization('');
      setExternalAllowDownload(false);
      setExternalExpiresAt(defaultExpirationIso());
      setLastInviteUrl(null);
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

  const isSubmitting =
    shareWithUser.isPending ||
    revokeShare.isPending ||
    createExternalShare.isPending ||
    revokeExternalShare.isPending ||
    regenerateExternalShare.isPending;

  const handleShare = () => {
    if (!selectedUser) return;
    shareWithUser.mutate(
      { sharedWithUserId: selectedUser.userId, canDownload: allowDownload },
      {
        onSuccess: () => {
          setSelectedUser(null);
          setSearch('');
        },
      },
    );
  };

  const handleExternalShare = () => {
    if (!externalEmail.trim()) return;

    if (externalPhone.trim() && !isCompleteWhatsapp(externalPhone)) {
      setExternalPhoneError(INVALID_EXTERNAL_PHONE_MESSAGE);
      return;
    }
    setExternalPhoneError(null);

    createExternalShare.mutate(
      {
        recipientEmail: externalEmail.trim(),
        recipientPhone: externalPhone.trim() || undefined,
        recipientName: externalName.trim() || undefined,
        recipientOrganizationName: externalOrganization.trim() || undefined,
        canDownload: externalAllowDownload,
        expiresAt: new Date(externalExpiresAt).toISOString(),
      },
      {
        onSuccess: (result) => {
          setLastInviteUrl(result.inviteUrl);
          setExternalEmail('');
          setExternalPhone('');
          setExternalPhoneError(null);
          setExternalName('');
          setExternalOrganization('');
          setExternalAllowDownload(false);
        },
      },
    );
  };

  const handleRegenerateExternalShare = (shareId: string) => {
    regenerateExternalShare.mutate(shareId, {
      onSuccess: (result) => {
        setLastInviteUrl(result.inviteUrl);
      },
    });
  };

  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && onClose()}
      className="modal-overlay-scrim fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-document-modal-title"
      data-testid="share-document-modal"
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-doqyn-border bg-doqyn-surface shadow-xl">
        <div className="border-b border-doqyn-border-subtle px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="share-document-modal-title"
                className="text-base font-semibold text-doqyn-text"
              >
                Compartilhar documento
              </h2>
              <p className="mt-1 truncate text-label text-doqyn-text">
                {document.currentFileName ?? document.displayName}
              </p>
              <p className="mt-0.5 text-caption text-doqyn-subtle">
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

          <div className="mt-4 flex gap-2" data-testid="share-document-tabs">
            <button
              type="button"
              onClick={() => setTab('internal')}
              className={[
                'rounded-lg px-3 py-1.5 text-caption font-medium',
                tab === 'internal'
                  ? 'bg-doqyn-accent-active/12 text-doqyn-accent-active'
                  : 'text-doqyn-subtle hover:bg-doqyn-surface-hover',
              ].join(' ')}
              data-testid="share-tab-internal"
            >
              Pessoas da empresa
            </button>
            <button
              type="button"
              onClick={() => setTab('external')}
              className={[
                'rounded-lg px-3 py-1.5 text-caption font-medium',
                tab === 'external'
                  ? 'bg-doqyn-accent-active/12 text-doqyn-accent-active'
                  : 'text-doqyn-subtle hover:bg-doqyn-surface-hover',
              ].join(' ')}
              data-testid="share-tab-external"
            >
              Convidados externos
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {tab === 'internal' ? (
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
                    <p className="text-caption text-doqyn-subtle">Buscando usuários…</p>
                  ) : availableUsers.length === 0 ? (
                    <p className="text-caption text-doqyn-subtle">
                      {search.trim()
                        ? 'Nenhum usuário encontrado.'
                        : 'Digite para buscar usuários ativos.'}
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
                              ? 'border-doqyn-accent-active/40 bg-doqyn-accent-active/8'
                              : 'border-transparent hover:border-doqyn-border-subtle hover:bg-doqyn-surface-hover',
                          ].join(' ')}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-doqyn-card text-micro font-semibold text-doqyn-muted">
                            {(user.name || user.email || '?').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-label text-doqyn-text">
                              {user.name}
                            </span>
                            {user.email ? (
                              <span className="block truncate text-micro text-doqyn-subtle">
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

              {selectedUser && (
                <label className="flex items-center gap-2 text-label font-normal text-doqyn-text">
                  <input
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(event) => setAllowDownload(event.target.checked)}
                    className="rounded border-doqyn-border"
                  />
                  Permitir download
                </label>
              )}

              <div>
                <p className="mb-2 text-eyebrow uppercase text-doqyn-subtle">
                  Pessoas com acesso compartilhado
                </p>
                {sharesQuery.isLoading ? (
                  <p className="text-caption text-doqyn-subtle">Carregando…</p>
                ) : (sharesQuery.data?.shares.length ?? 0) === 0 ? (
                  <p className="text-caption text-doqyn-subtle">
                    Ninguém com acesso compartilhado ainda.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {sharesQuery.data?.shares.map((share) => (
                      <div
                        key={share.shareId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-doqyn-border-subtle px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-label text-doqyn-text">
                            {share.sharedWithName}
                          </p>
                          <p className="text-micro text-doqyn-subtle">
                            {share.permissions.canDownload
                              ? 'Visualizar e baixar'
                              : 'Somente visualizar'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => revokeShare.mutate(share.shareId)}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-caption text-doqyn-subtle">
                Convidados externos terão acesso apenas a este documento. O link pode ser revogado a
                qualquer momento.
              </p>

              <div className="space-y-3">
                <Input
                  value={externalEmail}
                  onChange={(event) => setExternalEmail(event.target.value)}
                  placeholder="E-mail do destinatário"
                  aria-label="E-mail do destinatário externo"
                  type="email"
                  data-testid="external-share-email"
                />
                <div>
                  <WhatsappInput
                    id="external-share-phone"
                    label="Telefone / WhatsApp"
                    value={externalPhone}
                    optional
                    onChange={(value) => {
                      setExternalPhone(value);
                      if (externalPhoneError) setExternalPhoneError(null);
                    }}
                    placeholder={WHATSAPP_PLACEHOLDER}
                    error={externalPhoneError ?? undefined}
                    data-testid="external-share-phone"
                  />
                  <p className="mt-1.5 text-xs text-doqyn-subtle">
                    Opcional. Usaremos este número futuramente para notificações por WhatsApp.
                  </p>
                </div>
                <Input
                  value={externalName}
                  onChange={(event) => setExternalName(event.target.value)}
                  placeholder="Nome (opcional)"
                  aria-label="Nome do destinatário"
                />
                <Input
                  value={externalOrganization}
                  onChange={(event) => setExternalOrganization(event.target.value)}
                  placeholder="Empresa / organização (opcional)"
                  aria-label="Organização do destinatário"
                />
                <label className="block text-caption text-doqyn-subtle">
                  Expira em
                  <input
                    type="datetime-local"
                    value={externalExpiresAt}
                    onChange={(event) => setExternalExpiresAt(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-doqyn-border bg-doqyn-surface px-3 py-2 text-label font-normal text-doqyn-text"
                    data-testid="external-share-expires-at"
                  />
                </label>
                <label className="flex items-center gap-2 text-label font-normal text-doqyn-text">
                  <input
                    type="checkbox"
                    checked={externalAllowDownload}
                    onChange={(event) => setExternalAllowDownload(event.target.checked)}
                    className="rounded border-doqyn-border"
                    data-testid="external-share-can-download"
                  />
                  Permitir download
                </label>
              </div>

              {lastInviteUrl ? (
                <ExternalInviteLinkField
                  value={lastInviteUrl}
                  intro="Convite criado. Compartilhe o link abaixo com o convidado."
                  testId="external-share-invite-url"
                />
              ) : null}

              <div>
                <p className="mb-2 text-eyebrow uppercase text-doqyn-subtle">
                  Pessoas externas com acesso
                </p>
                {externalSharesQuery.isLoading ? (
                  <p className="text-caption text-doqyn-subtle">Carregando…</p>
                ) : (externalSharesQuery.data?.shares.length ?? 0) === 0 ? (
                  <p className="text-caption text-doqyn-subtle">Nenhum convidado externo ainda.</p>
                ) : (
                  <div className="space-y-1">
                    {externalSharesQuery.data?.shares.map((share) => (
                      <ExternalShareListItem
                        key={share.shareId}
                        share={share}
                        disabled={isSubmitting}
                        onRevoke={(shareId) => revokeExternalShare.mutate(shareId)}
                        onRegenerate={handleRegenerateExternalShare}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          {tab === 'internal' ? (
            <Button type="button" onClick={handleShare} disabled={!selectedUser || isSubmitting}>
              Compartilhar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleExternalShare}
              disabled={!externalEmail.trim() || isSubmitting}
              data-testid="external-share-submit"
            >
              Criar convite
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
