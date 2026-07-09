import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentListItem } from '@/types/document-library';
import { useDocumentShares, useShareableUsersSearch, useShareDocumentMutations } from '../hooks/useShareDocumentMutations';
import type { ShareableUser } from '../api/shareApi';

type ShareDocumentModalProps = {
  open: boolean;
  document: DocumentListItem | null;
  onClose: () => void;
};

export function ShareDocumentModal({ open, document, onClose }: ShareDocumentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ShareableUser | null>(null);
  const [allowDownload, setAllowDownload] = useState(false);

  const documentId = document?.documentId ?? null;
  const sharesQuery = useDocumentShares(documentId, open);
  const usersQuery = useShareableUsersSearch(documentId, search);
  const { shareWithUser, revokeShare } = useShareDocumentMutations(documentId);

  const availableUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => !user.alreadyShared),
    [usersQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedUser(null);
      setAllowDownload(false);
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

  const isSubmitting = shareWithUser.isPending || revokeShare.isPending;

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

  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center modal-overlay-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-document-modal-title"
      data-testid="share-document-modal"
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-doqyn-border bg-doqyn-surface shadow-xl">
        <div className="border-b border-doqyn-border-subtle px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="share-document-modal-title" className="text-base font-semibold text-doqyn-text">
                Compartilhar documento
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
        </div>

        <div className="space-y-4 px-5 py-4">
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

          {selectedUser && (
            <label className="flex items-center gap-2 text-[13px] text-doqyn-text">
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
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-doqyn-subtle">
              Pessoas com acesso compartilhado
            </p>
            {sharesQuery.isLoading ? (
              <p className="text-[12px] text-doqyn-subtle">Carregando…</p>
            ) : (sharesQuery.data?.shares.length ?? 0) === 0 ? (
              <p className="text-[12px] text-doqyn-subtle">Ninguém com acesso compartilhado ainda.</p>
            ) : (
              <div className="space-y-1">
                {sharesQuery.data?.shares.map((share) => (
                  <div
                    key={share.shareId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-doqyn-border-subtle px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-doqyn-text">
                        {share.sharedWithName}
                      </p>
                      <p className="text-[11px] text-doqyn-subtle">
                        {share.permissions.canDownload ? 'Visualizar e baixar' : 'Somente visualizar'}
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
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleShare}
            disabled={!selectedUser || isSubmitting}
          >
            Compartilhar
          </Button>
        </div>
      </div>
    </div>
  );
}
