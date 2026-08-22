import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow, SettingsRowList } from '../SettingsRow';
import { Badge } from '@/components/ui/Badge';
import { SettingsStatusBadge } from '../SettingsStatusBadge';
import { InlineErrorHint } from '@/components/ui/InlineErrorHint';
import { tenantEmailApi } from '../../api/tenantEmailApi';

const SMTP_PRESETS = [
  { id: 'gmail', label: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  { id: 'outlook', label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, secure: false },
  { id: 'custom', label: 'Outro servidor', host: '', port: 587, secure: false },
] as const;

export function TenantEmailSettingsSection() {
  const { hasAnyRole, user } = useAuth();
  const canManage = hasAnyRole(['company_admin']);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tenant-outbound-email'],
    queryFn: async () => (await tenantEmailApi.get()).outboundEmail,
    enabled: canManage,
  });

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data?.configured) return;
    setSmtpHost(data.smtpHost ?? '');
    setSmtpPort(data.smtpPort ?? 587);
    setSmtpSecure(Boolean(data.smtpSecure));
    setSmtpUser(data.smtpUser ?? '');
    setEnabled(data.enabled ?? true);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      tenantEmailApi.save({
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPassword,
        enabled,
      }),
    onSuccess: async () => {
      toast.success('SMTP da empresa salvo.');
      setSmtpPassword('');
      await queryClient.invalidateQueries({ queryKey: ['tenant-outbound-email'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar o SMTP.'),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      tenantEmailApi.test(
        smtpPassword
          ? { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword }
          : undefined,
      ),
    onSuccess: (result) => toast.success(result.message),
    onError: (error: Error) => toast.error(error.message || 'Falha ao enviar e-mail de teste.'),
  });

  if (!canManage) {
    return null;
  }

  const configured = Boolean(data?.configured);
  const adminDomain = user?.email?.split('@')[1]?.toLowerCase();
  const smtpDomain = data?.fromDomain ?? smtpUser.split('@')[1]?.toLowerCase();
  const domainAligned = !adminDomain || !smtpDomain || adminDomain === smtpDomain;

  return (
    <SettingsSectionBody>
      <SettingsCard density="compact">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-doqyn-border px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-base font-semibold text-doqyn-text">E-mail de convites</h3>
            <p className="mt-1 max-w-2xl text-sm text-doqyn-muted">
              Convites saem do e-mail profissional do administrador logado, usando o servidor SMTP da
              empresa. Sem custo de API — use Gmail Workspace, Microsoft 365 ou o SMTP do seu
              provedor.
            </p>
          </div>
          {configured && enabled ? (
            <Badge variant="success" size="xs">
              Configurado
            </Badge>
          ) : (
            <SettingsStatusBadge status="pending" />
          )}
        </div>

        {isError ? (
          <div className="px-4 py-5 sm:px-5">
            <InlineErrorHint
              message="Não foi possível carregar as configurações de e-mail."
              onRetry={() => void refetch()}
            />
          </div>
        ) : isLoading ? (
          <p className="px-4 py-5 text-sm text-doqyn-muted sm:px-5">Carregando configurações…</p>
        ) : (
          <div className="px-4 py-4 sm:px-5">
            <SettingsRowList>
              <SettingsRow
                label="Servidor SMTP"
                description="Escolha um preset ou informe host/porta do provedor de e-mail da empresa."
                className="settings-row--stack"
                control={
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      {SMTP_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (preset.host) setSmtpHost(preset.host);
                            setSmtpPort(preset.port);
                            setSmtpSecure(preset.secure);
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                      <Input
                        value={smtpHost}
                        onChange={(event) => setSmtpHost(event.target.value)}
                        placeholder="smtp.suaempresa.com.br"
                      />
                      <Input
                        type="number"
                        value={smtpPort}
                        onChange={(event) => setSmtpPort(Number(event.target.value) || 587)}
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
                    value={smtpUser}
                    onChange={(event) => setSmtpUser(event.target.value)}
                    placeholder="convites@suaempresa.com.br"
                  />
                }
              />

              <SettingsRow
                label="Senha / app password"
                description={
                  data?.hasPassword && !smtpPassword
                    ? 'Senha já salva. Preencha apenas se quiser alterar.'
                    : 'No Gmail/Outlook, gere uma senha de app se a conta tiver 2FA.'
                }
                control={
                  <Input
                    type="password"
                    value={smtpPassword}
                    onChange={(event) => setSmtpPassword(event.target.value)}
                    placeholder={data?.hasPassword ? '••••••••' : 'Senha SMTP'}
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

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !smtpHost || !smtpUser || (!smtpPassword && !data?.hasPassword)}
              >
                {saveMutation.isPending ? 'Salvando…' : 'Salvar SMTP'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !configured}
              >
                {testMutation.isPending ? 'Enviando teste…' : 'Enviar teste para mim'}
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>
    </SettingsSectionBody>
  );
}
