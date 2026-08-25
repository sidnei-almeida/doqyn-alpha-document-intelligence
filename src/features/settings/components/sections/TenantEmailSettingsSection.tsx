import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { InlineErrorHint } from '@/components/ui/InlineErrorHint';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsRow, SettingsRowList } from '../SettingsRow';
import type { TenantOutboundEmailConfig } from '../../api/tenantEmailApi';
import type { OutboundEmailDraft } from '../../hooks/useOrganizationSettings';

const SMTP_PRESETS = [
  {
    id: 'gmail',
    label: 'Google Workspace / Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
  },
  {
    id: 'outlook',
    label: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
  },
  { id: 'custom', label: 'Outro servidor', host: '', port: 587, secure: false },
] as const;

type TenantEmailSettingsSectionProps = {
  draft: OutboundEmailDraft;
  onChange: (draft: OutboundEmailDraft) => void;
  config: TenantOutboundEmailConfig | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onTest: () => void;
  testing: boolean;
  canTest: boolean;
};

/**
 * Bloco de leitura/edição. Salvar é da barra da tela; "Enviar teste" continua aqui
 * porque é ação, não configuração — e só vale sobre o que já está salvo.
 */
export function TenantEmailSettingsSection({
  draft,
  onChange,
  config,
  isLoading,
  isError,
  onRetry,
  onTest,
  testing,
  canTest,
}: TenantEmailSettingsSectionProps) {
  const { user } = useAuth();

  const configured = Boolean(config?.configured);
  const adminDomain = user?.email?.split('@')[1]?.toLowerCase();
  const smtpDomain = config?.fromDomain ?? draft.smtpUser.split('@')[1]?.toLowerCase();
  const domainAligned = !adminDomain || !smtpDomain || adminDomain === smtpDomain;

  if (isError) {
    return (
      <SettingsSectionBody>
        <InlineErrorHint
          message="Não foi possível carregar as configurações de e-mail."
          onRetry={onRetry}
        />
      </SettingsSectionBody>
    );
  }

  if (isLoading) {
    return (
      <SettingsSectionBody>
        <p className="text-sm text-doqyn-muted">Carregando configurações…</p>
      </SettingsSectionBody>
    );
  }

  return (
    <SettingsSectionBody>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-doqyn-muted">
          Convites saem do e-mail profissional do administrador logado, usando o servidor SMTP da
          empresa. Sem custo de API — use Gmail Workspace, Microsoft 365 ou o SMTP do seu provedor.
        </p>
        <Badge variant={configured && draft.enabled ? 'success' : 'neutral'} size="xs">
          {configured && draft.enabled ? 'Configurado' : 'SMTP pendente'}
        </Badge>
      </div>

      <SettingsRowList>
        <SettingsRow
          label="Servidor SMTP"
          description="Escolha um preset ou informe host/porta do provedor de e-mail da empresa."
          className="settings-row--stack"
          control={
            <div className="grid gap-3">
              <div className="settings-segmented-control">
                {SMTP_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      'settings-segmented-control__item',
                      draft.smtpHost === preset.host &&
                        preset.host !== '' &&
                        'settings-segmented-control__item--active',
                    )}
                    onClick={() =>
                      onChange({
                        ...draft,
                        smtpHost: preset.host ? preset.host : draft.smtpHost,
                        smtpPort: preset.port,
                        smtpSecure: preset.secure,
                      })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <Input
                  value={draft.smtpHost}
                  onChange={(event) => onChange({ ...draft, smtpHost: event.target.value })}
                  placeholder="smtp.suaempresa.com.br"
                />
                <Input
                  type="number"
                  value={draft.smtpPort}
                  onChange={(event) =>
                    onChange({ ...draft, smtpPort: Number(event.target.value) || 587 })
                  }
                  placeholder="587"
                />
              </div>
            </div>
          }
        />

        <SettingsRow
          label="Conta SMTP"
          description="Use um usuário do domínio da empresa (ex.: convites@suaempresa.com.br)."
          control={
            <Input
              type="email"
              value={draft.smtpUser}
              onChange={(event) => onChange({ ...draft, smtpUser: event.target.value })}
              placeholder="convites@suaempresa.com.br"
            />
          }
        />

        <SettingsRow
          label="Senha / app password"
          description={
            config?.hasPassword && !draft.smtpPassword
              ? 'Senha já salva. Preencha apenas se quiser alterar.'
              : 'No Gmail/Outlook, gere uma senha de app se a conta tiver 2FA.'
          }
          control={
            <Input
              type="password"
              value={draft.smtpPassword}
              onChange={(event) => onChange({ ...draft, smtpPassword: event.target.value })}
              placeholder={config?.hasPassword ? '••••••••' : 'Senha SMTP'}
            />
          }
        />

        <SettingsRow
          label="Remetente dos convites"
          description={`Os convites serão enviados como ${user?.email ?? 'seu e-mail profissional'} quando você convidar alguém.`}
          control={
            <p className="text-sm text-doqyn-text">
              {user?.email ?? '—'}
              {!domainAligned && (
                <span className="mt-1 block text-doqyn-danger">
                  Seu e-mail precisa ser do mesmo domínio configurado no SMTP (
                  {smtpDomain || 'domínio da conta SMTP'}).
                </span>
              )}
            </p>
          }
        />
      </SettingsRowList>

      <div className="settings-block__action">
        <Button variant="secondary" size="sm" onClick={onTest} disabled={testing || !canTest}>
          {testing ? 'Enviando teste…' : 'Enviar teste para mim'}
        </Button>
        <p className="settings-section-note">
          {canTest
            ? 'O teste usa o SMTP já salvo.'
            : 'Salve as alterações desta tela antes de enviar o teste.'}
        </p>
      </div>
    </SettingsSectionBody>
  );
}
