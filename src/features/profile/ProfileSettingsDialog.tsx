import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/auth/useAuth';
import { formatPlatformRolesList, getAuthRoleLabel } from '@/features/users/platformRoleLabels';
import {
  validateProfileAvatarFile,
} from '@/features/profile/api/profileApi';
import { useProfileAvatarMutations, useProfileMe } from '@/features/profile/hooks/useProfile';

type ProfileSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function ProfileSettingsDialog({ open, onClose }: ProfileSettingsDialogProps) {
  const { user, roles, tenant, refreshUser } = useAuth();
  const profileQuery = useProfileMe(open);
  const { uploadMutation, removeMutation } = useProfileAvatarMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const profile = profileQuery.data;
  const avatar = profile?.avatar;
  const displayAvatarUrl = previewUrl ?? avatar?.url ?? null;

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setLocalError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateProfileAvatarFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      await uploadMutation.mutateAsync(file);
      await refreshUser();
      setPreviewUrl(null);
    } catch (error) {
      setPreviewUrl(null);
      setLocalError(error instanceof Error ? error.message : 'Não foi possível enviar a foto.');
    }
  };

  const handleRemove = async () => {
    setLocalError(null);
    try {
      await removeMutation.mutateAsync();
      await refreshUser();
      setPreviewUrl(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível remover a foto.');
    }
  };

  const isBusy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-settings-title"
        className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 id="profile-settings-title" className="text-base font-semibold text-doqyn-text">
              Configurações de perfil
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">Foto, dados da conta e preferências</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={ICON_SIZE.xs} />
          </Button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <UserAvatar
              name={user?.name}
              email={user?.email}
              avatarUrl={displayAvatarUrl}
              size="lg"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadMutation.isPending ? (
                  <Icon name="progress_activity" size={ICON_SIZE.xs} className="mr-1.5 animate-spin" />
                ) : (
                  <Icon name="photo_camera" size={ICON_SIZE.xs} className="mr-1.5" />
                )}
                Alterar foto
              </Button>
              {avatar?.status === 'active' && avatar.version > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void handleRemove()}
                >
                  <Icon name="delete" size={ICON_SIZE.xs} className="mr-1.5" />
                  Remover foto
                </Button>
              )}
            </div>
            <p className="text-[11px] text-doqyn-muted">JPG, PNG ou WebP · até 5 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
          </div>

          {localError && (
            <p className="rounded-md border border-doqyn-danger-border bg-doqyn-danger-bg px-3 py-2 text-sm text-doqyn-danger">
              {localError}
            </p>
          )}

          <div className="space-y-3 rounded-lg border border-doqyn-border/70 bg-doqyn-bg/40 p-4 text-sm">
            <div>
              <p className="text-xs text-doqyn-muted">Nome</p>
              <p className="font-medium text-doqyn-text">{user?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">E-mail</p>
              <p className="text-doqyn-text">{user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Organização</p>
              <p className="text-doqyn-text">{tenant?.displayName ?? user?.companyName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Papel</p>
              <p className="text-doqyn-text">
                {roles.length
                  ? formatPlatformRolesList(roles)
                  : user?.role
                    ? getAuthRoleLabel(user.role)
                    : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
