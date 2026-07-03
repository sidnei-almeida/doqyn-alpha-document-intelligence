import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { getAuthProviderType, usesDoqynAuth } from '@/auth/authConfig';
import { AUTH_MODE_LABELS, AUTH_PROVIDER_LABELS } from '@/lib/constants';
import { ChangePasswordForm } from '@/features/settings/components/ChangePasswordForm';

export function SettingsPage() {
  const authProvider = getAuthProviderType();
  const authLabel = AUTH_PROVIDER_LABELS[authProvider] ?? AUTH_MODE_LABELS[authProvider] ?? authProvider;

  return (
    <PageShell
      eyebrow="Administração"
      title="Configurações"
      description="Preferências do sistema e informações de acesso."
      bodyClassName="min-h-0"
    >
      <div className="grid flex-1 gap-6 lg:grid-cols-2">
      <Card className="min-h-[200px]">
        <CardHeader>
          <CardTitle>Autenticação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-doqyn-muted">Modo de autenticação</span>
            <span className="font-medium text-doqyn-text">{authLabel}</span>
          </div>
          {authProvider === 'doqyn_auth' && (
            <p className="text-xs text-doqyn-subtle">
              Autenticação via doqyn-auth-service com sessão segura em cookie HttpOnly.
            </p>
          )}
          {authProvider === 'temporary' && (
            <p className="text-xs text-doqyn-subtle">
              Desenvolvimento: login por credenciais via API com sessão segura em cookie.
            </p>
          )}
          {authProvider === 'mock' && (
            <p className="text-xs text-doqyn-subtle">
              Modo mock: usuário de desenvolvimento em memória.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-[200px]">
        <CardHeader>
          <CardTitle>Segurança e conformidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-doqyn-muted">
            Todas as ações são registradas para auditoria. Documentos e versões são preservados
            permanentemente no histórico da plataforma.
          </p>

          {usesDoqynAuth() && (
            <div className="space-y-3 border-t border-doqyn-border pt-6">
              <div>
                <h3 className="text-sm font-medium text-doqyn-text">Alterar senha</h3>
                <p className="mt-1 text-xs text-doqyn-subtle">
                  Atualize a senha da sua conta. Outras sessões ativas serão encerradas.
                </p>
              </div>
              <ChangePasswordForm />
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
