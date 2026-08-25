import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { PlatformRoleChips } from '@/components/ui/PlatformRoleChips';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { validateProfileAvatarFile } from '@/features/profile/api/profileApi';
import { useProfileAvatarMutations, useProfileMe } from '@/features/profile/hooks/useProfile';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { getAuthRoleLabel } from '@/features/users/platformRoleLabels';
import type { PlatformRole } from '@/features/users/api/usersApi';
import { Badge } from '@/components/ui/Badge';
import { showAppToast } from '@/shared/feedback/appFeedback';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { accountProfileApi } from '../../api/accountProfileApi';

/**
 * Identidade tem salvamento próprio: nome e sobrenome só valem depois de "Salvar identidade".
 * A foto continua valendo no instante do envio — é ação, não campo de formulário.
 */
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
  const hasAvatar = Boolean(avatar?.status === 'active' || user?.avatarUrl || previewUrl);
  const platformRoles = (roles.length ? roles : user?.role ? [user.role] : []) as PlatformRole[];

  const savedFirstName = user?.firstName ?? profile?.firstName ?? '';
  const savedLastName = user?.lastName ?? profile?.lastName ?? '';
  const [firstName, setFirstName] = useState(savedFirstName);
  const [lastName, setLastName] = useState(savedLastName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(savedFirstName);
    setLastName(savedLastName);
  }, [savedFirstName, savedLastName]);

  const dirty = firstName.trim() !== savedFirstName || lastName.trim() !== savedLastName;

  async function handleSaveIdentity() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await accountProfileApi.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      await refreshUser();
      showAppToast({
        type: 'success',
        title: 'Identidade salva',
        message: 'Seu nome já aparece assim no app.',
      });
    } catch (error) {
      showAppToast({
        type: 'error',
        title: 'Não foi possível salvar',
        message: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }

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
      <div className="settings-identity">
        <div className="settings-identity__avatar">
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
              className="h-16 w-16 text-sm sm:h-20 sm:w-20 sm:text-base"
            />
            <span className="settings-profile-avatar-overlay absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {uploadMutation.isPending ? (
                <Icon
                  name="progress_activity"
                  size={ICON_SIZE.md}
                  className="animate-spin text-white"
                />
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
            >
              Remover foto
            </Button>
          ) : (
            <p className="type-caption max-w-[8rem] text-center text-doqyn-subtle">
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

        <div className="settings-identity__fields">
          <Input
            variant="rule"
            label="Nome"
            value={firstName}
            maxLength={80}
            autoComplete="given-name"
            onChange={(event) => setFirstName(event.target.value)}
          />
          <Input
            variant="rule"
            label="Sobrenome"
            value={lastName}
            maxLength={80}
            autoComplete="family-name"
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <dl className="settings-register-facts">
        <div>
          <dt className="register-label text-doqyn-subtle">E-mail</dt>
          <dd className="type-body mt-0.5 break-words text-doqyn-text">{user?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="register-label text-doqyn-subtle">Organização</dt>
          <dd className="type-body mt-0.5 break-words text-doqyn-text">
            {tenant?.displayName ?? user?.companyName ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="register-label text-doqyn-subtle">Papéis</dt>
          <dd className="mt-1">
            {roles.length ? (
              <PlatformRoleChips roles={platformRoles} className="flex flex-wrap gap-1.5" />
            ) : user?.role ? (
              <Badge variant="neutral" dot={false} className="font-medium normal-case">
                {getAuthRoleLabel(user.role)}
              </Badge>
            ) : (
              <span className="type-body text-doqyn-muted">—</span>
            )}
          </dd>
        </div>
      </dl>

      {localError ? (
        <p className="settings-inline-error" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="settings-block__action settings-block__action--end">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => void handleSaveIdentity()}
        >
          {saving ? 'Salvando…' : 'Salvar identidade'}
        </Button>
      </div>
    </SettingsSectionBody>
  );
}
