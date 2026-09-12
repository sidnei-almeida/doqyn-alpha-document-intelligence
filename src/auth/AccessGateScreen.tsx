import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { AuthBrandLogo } from '@/components/brand';
import { AuthCard } from '@/components/layout/AuthShell';

/**
 * As frases moram em `common`, e não em `auth`: esta tela aparece acima do roteador, antes de
 * qualquer rota pedir o catálogo da antessala, e `common` é o único que já vem carregado.
 */
const GATE_COPY = {
  not_linked: {
    titleKey: 'accessGate.notLinked.title',
    messageKey: 'accessGate.notLinked.message',
    variant: 'warning' as const,
  },
  pending: {
    titleKey: 'accessGate.pending.title',
    messageKey: 'accessGate.pending.message',
    variant: 'info' as const,
  },
  blocked: {
    titleKey: 'accessGate.blocked.title',
    messageKey: 'accessGate.blocked.message',
    variant: 'error' as const,
  },
  rejected: {
    titleKey: 'accessGate.rejected.title',
    messageKey: 'accessGate.rejected.message',
    variant: 'error' as const,
  },
  removed: {
    titleKey: 'accessGate.removed.title',
    messageKey: 'accessGate.removed.message',
    variant: 'warning' as const,
  },
  no_membership: {
    titleKey: 'accessGate.noMembership.title',
    messageKey: 'accessGate.noMembership.message',
    variant: 'info' as const,
  },
} as const;

const GATE_ACTIONS: Partial<
  Record<
    keyof typeof GATE_COPY,
    Array<{ labelKey: string; href: string; variant?: 'primary' | 'secondary' }>
  >
> = {
  /* `/acesso` apresenta os caminhos que a pessoa percorre sozinha — cadastrar uma empresa ou
     abrir conta pessoal. Entrar numa empresa que já existe não está entre eles: depende de
     alguém de dentro convidar, e o convite chega por link. */
  no_membership: [
    { labelKey: 'authErrorAction.verFormasDeAcesso', href: '/acesso', variant: 'primary' },
  ],
  /* Recusado e removido não ganham botão. Voltar depende de um convite novo, que sai das mãos de
     quem administra a empresa — mandar a pessoa para uma tela onde ela não resolve nada seria
     fingir que há um caminho. O texto de `GATE_COPY` já diz de quem depende. */
};

export function AccessGateScreen({
  reason,
  onLogout,
  email,
  tenantName,
  message,
}: {
  reason: keyof typeof GATE_COPY;
  onLogout: () => void;
  email?: string;
  tenantName?: string;
  message?: string;
}) {
  const { t } = useTranslation('common');
  const copy = GATE_COPY[reason];
  const actions = GATE_ACTIONS[reason] ?? [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-10">
      <div className="flow-enter w-full max-w-md text-center">
        <AuthBrandLogo subtitle={t('accessGate.subtitle')} className="mb-6" />

        <AuthCard className="p-6 text-left">
          <AlertBanner
            variant={copy.variant}
            title={t(copy.titleKey)}
            message={message ?? t(copy.messageKey)}
          />

          {reason === 'pending' && (email || tenantName) ? (
            <dl className="mt-4 space-y-2 rounded-lg border border-doqyn-border bg-doqyn-bg px-3 py-2.5 text-xs text-doqyn-muted">
              {email ? (
                <div>
                  <dt className="text-doqyn-subtle">{t('accessGate.email')}</dt>
                  <dd className="mt-0.5 text-doqyn-text">{email}</dd>
                </div>
              ) : null}
              {tenantName ? (
                <div>
                  <dt className="text-doqyn-subtle">{t('accessGate.workspace')}</dt>
                  <dd className="mt-0.5 text-doqyn-text">{tenantName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-doqyn-subtle">{t('accessGate.status')}</dt>
                <dd className="mt-0.5 text-doqyn-text">{t('memberStatus.pending')}</dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            {actions.map((action) => (
              <Link key={action.href} to={action.href}>
                <Button type="button" variant={action.variant ?? 'primary'} className="w-full">
                  {t(action.labelKey)}
                </Button>
              </Link>
            ))}
            <Button type="button" variant="secondary" className="w-full" onClick={onLogout}>
              {t('accessGate.logout')}
            </Button>
          </div>
        </AuthCard>
      </div>
    </main>
  );
}
