import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const GATE_COPY = {
  not_linked: {
    title: 'Acesso pendente',
    message:
      'Seu usuário ainda não está vinculado a um cliente ativo no DOQYN. Entre em contato com o administrador da empresa ou solicite acesso.',
  },
  pending: {
    title: 'Aguardando aprovação',
    message:
      'Sua solicitação está em análise pelo administrador da empresa. Você receberá acesso assim que for aprovado.',
  },
  blocked: {
    title: 'Acesso bloqueado',
    message: 'Seu acesso a esta empresa foi bloqueado.',
  },
  rejected: {
    title: 'Solicitação rejeitada',
    message: 'Sua solicitação de acesso a esta empresa foi rejeitada.',
  },
  removed: {
    title: 'Acesso removido',
    message: 'Você não faz mais parte desta empresa no DOQYN.',
  },
  no_membership: {
    title: 'Sem empresa ativa',
    message: 'Sua conta ainda não possui acesso ativo a nenhuma empresa.',
  },
} as const;

const GATE_ACTIONS: Partial<
  Record<keyof typeof GATE_COPY, Array<{ label: string; href: string; variant?: 'primary' | 'secondary' }>>
> = {
  no_membership: [
    { label: 'Solicitar acesso a uma empresa', href: '/solicitar-acesso', variant: 'primary' },
    { label: 'Cadastrar uma empresa', href: '/criar-empresa', variant: 'secondary' },
  ],
  rejected: [{ label: 'Solicitar acesso a outra empresa', href: '/solicitar-acesso', variant: 'primary' }],
  removed: [{ label: 'Solicitar acesso a uma empresa', href: '/solicitar-acesso', variant: 'primary' }],
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-doqyn-bg px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-doqyn-text">{copy.title}</h1>
        <p className="text-sm text-doqyn-muted">{message ?? copy.message}</p>
        {reason === 'pending' && (email || tenantName) && (
          <div className="mt-4 rounded-md border border-doqyn-border bg-doqyn-surface p-3 text-left text-xs text-doqyn-muted">
            {email && <p>E-mail: {email}</p>}
            {tenantName && <p>Cliente: {tenantName}</p>}
            <p className="mt-1">Status: pendente</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action) => (
          <Link key={action.href} to={action.href}>
            <Button type="button" variant={action.variant ?? 'primary'} className="w-full min-w-[240px]">
              {action.label}
            </Button>
          </Link>
        ))}
        <Button type="button" variant="secondary" onClick={onLogout}>
          Sair
        </Button>
      </div>
    </div>
  );
}
