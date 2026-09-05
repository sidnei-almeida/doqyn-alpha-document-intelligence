import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { AuthBrandLogo } from '@/components/brand';
import { AuthCard } from '@/components/layout/AuthShell';

const GATE_COPY = {
  not_linked: {
    title: 'Acesso pendente',
    message:
      'Seu usuário ainda não está vinculado a um cliente ativo no DOQYN. Peça um convite ao administrador da empresa.',
    variant: 'warning' as const,
  },
  pending: {
    title: 'Aguardando liberação',
    message:
      'Seu acesso a esta empresa ainda não foi liberado. Quem administra a empresa resolve isso.',
    variant: 'info' as const,
  },
  blocked: {
    title: 'Acesso bloqueado',
    message: 'Seu acesso a este ambiente foi bloqueado.',
    variant: 'error' as const,
  },
  rejected: {
    title: 'Acesso recusado',
    message:
      'Seu acesso a este ambiente foi recusado. Voltar depende de um convite novo de quem administra a empresa.',
    variant: 'error' as const,
  },
  removed: {
    title: 'Acesso removido',
    message:
      'Você não faz mais parte deste ambiente no DOQYN. Voltar depende de um convite novo de quem administra a empresa.',
    variant: 'warning' as const,
  },
  no_membership: {
    title: 'Sem acesso ativo',
    message: 'Sua conta ainda não tem acesso ativo a nenhum ambiente no DOQYN.',
    variant: 'info' as const,
  },
} as const;

const GATE_ACTIONS: Partial<
  Record<
    keyof typeof GATE_COPY,
    Array<{ label: string; href: string; variant?: 'primary' | 'secondary' }>
  >
> = {
  /* `/acesso` apresenta os caminhos que a pessoa percorre sozinha — cadastrar uma empresa ou
     abrir conta pessoal. Entrar numa empresa que já existe não está entre eles: depende de
     alguém de dentro convidar, e o convite chega por link. */
  no_membership: [{ label: 'Ver formas de acesso', href: '/acesso', variant: 'primary' }],
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
  const copy = GATE_COPY[reason];
  const actions = GATE_ACTIONS[reason] ?? [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-10">
      <div className="flow-enter w-full max-w-md text-center">
        <AuthBrandLogo subtitle="Acesso à plataforma" className="mb-6" />

        <AuthCard className="p-6 text-left">
          <AlertBanner
            variant={copy.variant}
            title={copy.title}
            message={message ?? copy.message}
          />

          {reason === 'pending' && (email || tenantName) ? (
            <dl className="mt-4 space-y-2 rounded-lg border border-doqyn-border bg-doqyn-bg px-3 py-2.5 text-xs text-doqyn-muted">
              {email ? (
                <div>
                  <dt className="text-doqyn-subtle">E-mail</dt>
                  <dd className="mt-0.5 text-doqyn-text">{email}</dd>
                </div>
              ) : null}
              {tenantName ? (
                <div>
                  <dt className="text-doqyn-subtle">Cliente</dt>
                  <dd className="mt-0.5 text-doqyn-text">{tenantName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-doqyn-subtle">Status</dt>
                <dd className="mt-0.5 text-doqyn-text">Pendente</dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            {actions.map((action) => (
              <Link key={action.href} to={action.href}>
                <Button type="button" variant={action.variant ?? 'primary'} className="w-full">
                  {action.label}
                </Button>
              </Link>
            ))}
            <Button type="button" variant="secondary" className="w-full" onClick={onLogout}>
              Sair
            </Button>
          </div>
        </AuthCard>
      </div>
    </main>
  );
}
