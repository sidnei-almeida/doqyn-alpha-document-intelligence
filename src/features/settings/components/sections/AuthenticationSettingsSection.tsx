import { useState } from 'react';
import { getAuthProviderType, usesDoqynAuth } from '@/auth/authConfig';
import { Icon } from '@/components/ui/Icon';
import { AUTH_MODE_LABELS, AUTH_PROVIDER_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsFieldGroup } from '../SettingsFieldGroup';
import { SettingsStatusBadge } from '../SettingsStatusBadge';
import { PasswordChangeCard } from '../PasswordChangeCard';

function authSummaryLine(provider: ReturnType<typeof getAuthProviderType>, label: string): string {
  switch (provider) {
    case 'doqyn_auth':
      return `Login via ${label} · sessão segura com renovação automática`;
    case 'temporary':
      return `Login via ${label} · sessão segura com renovação automática`;
    case 'mock':
      return `Login via ${label} · modo de desenvolvimento local`;
    default:
      return `Login via ${label} · sessão segura com renovação automática`;
  }
}

export function AuthenticationSettingsSection() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const authProvider = getAuthProviderType();
  const authLabel =
    AUTH_PROVIDER_LABELS[authProvider] ?? AUTH_MODE_LABELS[authProvider] ?? authProvider;
  const summary = authSummaryLine(authProvider, authLabel);

  return (
    <SettingsSectionBody>
      <div className="settings-auth-overview">
        <div className="settings-summary-bar" role="status">
          <div className="settings-summary-bar__label">
            <Icon name="lock" size={14} aria-hidden />
            <span className="settings-summary-bar__chip">{summary}</span>
          </div>
          <button
            type="button"
            className="settings-auth-overview__toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            {detailsOpen ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
            <Icon
              name="expand_more"
              size={16}
              className={cn(
                'transition-transform',
                detailsOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        </div>

        {detailsOpen ? (
          <SettingsCard className="settings-auth-overview__details">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="settings-dt">Provedor</dt>
                <dd className="settings-dd">{authLabel}</dd>
              </div>
              <div>
                <dt className="settings-dt">Sessão</dt>
                <dd className="settings-dd">Cookie seguro · renovação automática</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="settings-dt">OAuth</dt>
                <dd className="settings-dd">Google / Microsoft quando configurado no tenant</dd>
              </div>
            </dl>
            {authProvider === 'doqyn_auth' ? (
              <p className="mt-4 text-xs text-doqyn-subtle">
                Sessão segura via cookie HttpOnly com doqyn-auth-service.
              </p>
            ) : null}
            {authProvider === 'temporary' ? (
              <p className="mt-4 text-xs text-doqyn-subtle">
                Desenvolvimento: credenciais via API com sessão em cookie.
              </p>
            ) : null}
            {authProvider === 'mock' ? (
              <p className="mt-4 text-xs text-doqyn-subtle">
                Modo mock para desenvolvimento local.
              </p>
            ) : null}
          </SettingsCard>
        ) : null}
      </div>

      {usesDoqynAuth() ? <PasswordChangeCard /> : null}

      <SettingsFieldGroup
        title="Sessões ativas"
        description="Visualização e revogação de sessões em outros dispositivos."
      >
        <div className="settings-locked-option">
          <div className="settings-locked-option__control min-w-0">
            <p className="text-sm text-doqyn-text">Gerenciamento de dispositivos</p>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              Em breve você poderá ver e encerrar sessões abertas em outros aparelhos.
            </p>
          </div>
          <SettingsStatusBadge status="pending" className="settings-locked-option__badge" />
        </div>
      </SettingsFieldGroup>
    </SettingsSectionBody>
  );
}
