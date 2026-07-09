import { useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { validateProfileAvatarFile } from '@/features/profile/api/profileApi';
import { useProfileAvatarMutations, useProfileMe } from '@/features/profile/hooks/useProfile';
import { ICON_SIZE } from '@/lib/iconDefaults';
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
      <SettingsCard>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <UserAvatar
              name={user?.name}
              email={user?.email}
              avatarUrl={displayAvatarUrl}
              size="lg"
            />
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadMutation.isPending ? (
                  <Icon name="progress_activity" className="mr-1.5 animate-spin" size={ICON_SIZE.xs} />
                ) : (
                  <Icon name="photo_camera" className="mr-1.5" size={ICON_SIZE.xs} />
                )}
                Alterar foto
              </Button>
              {(avatar?.status === 'active' || user?.avatarUrl) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void handleRemove()}
                >
                  <Icon name="delete" className="mr-1.5" size={ICON_SIZE.xs} />
                  Remover foto
                </Button>
              )}
            </div>
            <p className="text-center text-[11px] text-doqyn-muted sm:text-left">
              JPG, PNG ou WebP · até 5 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
          </div>

          <dl className="grid flex-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="settings-dt">Nome</dt>
              <dd className="settings-dd">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="settings-dt">E-mail</dt>
              <dd className="settings-dd">{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="settings-dt">Organização</dt>
              <dd className="settings-dd">{tenant?.displayName ?? user?.companyName ?? '—'}</dd>
            </div>
            <div>
              <dt className="settings-dt">Papel</dt>
              <dd className="settings-dd">{roles[0] ?? user?.role ?? '—'}</dd>
            </div>
            <div>
              <dt className="settings-dt">Provedor de login</dt>
              <dd className="settings-dd">{profile?.authProvider ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {localError && (
          <p className="mt-4 rounded-md border border-doqyn-danger-border bg-doqyn-danger-bg px-3 py-2 text-sm text-doqyn-danger">
            {localError}
          </p>
        )}
      </SettingsCard>
    </SettingsSectionBody>
  );
}
