import { useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PlatformRoleChips } from '@/components/ui/PlatformRoleChips';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { validateProfileAvatarFile } from '@/features/profile/api/profileApi';
import { useProfileAvatarMutations, useProfileMe } from '@/features/profile/hooks/useProfile';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { getAuthRoleLabel } from '@/features/users/platformRoleLabels';
import type { PlatformRole } from '@/features/users/api/usersApi';
import { Badge } from '@/components/ui/Badge';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';

export function ProfileSettingsSection() {
  const { user, roles, tenant, refreshUser } = useAuth();
  const profileQuery = useProfileMe(Boolean(user?.id));
  const { uploadMutation, removeMutation } = useProfileAvatarMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const profile = profileQuery.data;
  const avatar = profile?.avatar;
  const displayAvatarUrl = previewUrl ?? user?.avatarUrl ?? avatar?.url ?? null;
  const isBusy = uploadMutation.isPending || removeMutation.isPending;
  const displayName = user?.name?.trim() || user?.email || 'Usuário';
  const hasAvatar = Boolean(avatar?.status === 'active' || user?.avatarUrl || previewUrl);
  const platformRoles = (roles.length ? roles : user?.role ? [user.role] : []) as PlatformRole[];

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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
  }

  async function handleRemove() {
    setLocalError(null);
    try {
      await removeMutation.mutateAsync();
      await refreshUser();
      setPreviewUrl(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Não foi possível remover a foto.');
    }
  }

  return (
    <SettingsSectionBody>
      <SettingsCard density="compact" className="settings-profile-card max-w-2xl">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="settings-profile-avatar-trigger group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg disabled:opacity-60"
              aria-label="Alterar foto"
              title="Alterar foto"
            >
              <UserAvatar
                name={user?.name}
                email={user?.email}
                avatarUrl={displayAvatarUrl}
                size="lg"
                className="h-20 w-20 text-base sm:h-24 sm:w-24 sm:text-lg"
              />
              <span className="settings-profile-avatar-overlay absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {uploadMutation.isPending ? (
                  <Icon name="progress_activity" size={ICON_SIZE.md} className="animate-spin text-white" />
                ) : (
                  <Icon name="photo_camera" size={ICON_SIZE.md} className="text-white" />
                )}
              </span>
            </button>
            {hasAvatar ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => void handleRemove()}
                className="h-7 px-2 text-[11px] text-doqyn-muted"
              >
                Remover foto
              </Button>
            ) : (
              <p className="max-w-[6.5rem] text-center text-[10px] leading-tight text-doqyn-subtle">
                JPG, PNG ou WebP · até 5 MB
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3 pt-0.5">
            <div>
              <h3 className="truncate text-lg font-semibold tracking-tight text-doqyn-text sm:text-xl">
                {displayName}
              </h3>
              <p className="mt-0.5 truncate text-sm text-doqyn-muted">{user?.email ?? '—'}</p>
            </div>

            <div>
              <p className="settings-dt mb-1.5">Papéis</p>
              {roles.length ? (
                <PlatformRoleChips roles={platformRoles} className="flex flex-wrap gap-1.5" />
              ) : user?.role ? (
                <Badge variant="neutral" dot={false} className="font-medium normal-case tracking-normal">
                  {getAuthRoleLabel(user.role)}
                </Badge>
              ) : (
                <span className="text-sm text-doqyn-muted">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="settings-profile-details mt-5 border-t border-doqyn-border-subtle/70 pt-4">
          <p className="settings-dt mb-3">Detalhes da conta</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-doqyn-subtle">Organização</dt>
              <dd className="mt-0.5 text-sm text-doqyn-text">
                {tenant?.displayName ?? user?.companyName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-doqyn-subtle">Provedor de login</dt>
              <dd className="mt-0.5 text-sm text-doqyn-text">{profile?.authProvider ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {localError ? (
          <p className="mt-4 rounded-md border border-doqyn-danger-border bg-doqyn-danger-bg px-3 py-2 text-sm text-doqyn-danger">
            {localError}
          </p>
        ) : null}
      </SettingsCard>
    </SettingsSectionBody>
  );
}
