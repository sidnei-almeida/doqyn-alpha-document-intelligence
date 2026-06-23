import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AUTH_MODE, AUTH_MODE_LABELS, isKeycloakConfigured } from '@/lib/constants';

export function SettingsPage() {
  const authLabel = AUTH_MODE_LABELS[AUTH_MODE] ?? AUTH_MODE;
  const keycloakReady = isKeycloakConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Preferências do sistema e informações de acesso."
      />

      <Card>
        <CardHeader>
          <CardTitle>Autenticação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-doqyn-muted">Modo de autenticação</span>
            <span className="font-medium text-doqyn-text">{authLabel}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-doqyn-muted">Keycloak (SSO)</span>
            <span className="text-doqyn-text">
              {AUTH_MODE === 'keycloak'
                ? keycloakReady
                  ? 'Ativo e configurado'
                  : 'Modo ativo — variáveis pendentes'
                : keycloakReady
                  ? 'Configurado — ative com VITE_AUTH_MODE=keycloak'
                  : 'Disponível na próxima fase'}
            </span>
          </div>
          {AUTH_MODE === 'temporary' && (
            <p className="text-xs text-doqyn-subtle">
              Desenvolvimento: login por credenciais via API com sessão segura em cookie.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança e conformidade</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-doqyn-muted">
            Todas as ações são registradas para auditoria. Documentos e versões são preservados
            permanentemente no histórico da plataforma.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
