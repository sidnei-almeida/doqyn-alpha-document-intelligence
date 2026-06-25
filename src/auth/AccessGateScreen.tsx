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
      'Sua solicitação foi recebida. O administrador responsável precisa revisar seus dados, confirmar seu setor e definir seus grupos de acesso antes de liberar o uso do DOQYN.',
  },
  blocked: {
    title: 'Acesso bloqueado',
    message: 'Seu acesso ao DOQYN está bloqueado. Entre em contato com o administrador.',
  },
  removed: {
    title: 'Acesso removido',
    message: 'Seu vínculo com esta empresa foi removido. Solicite novo acesso se necessário.',
  },
  no_membership: {
    title: 'Empresa não selecionada',
    message: 'Selecione uma empresa ativa ou entre em contato com o administrador.',
  },
} as const;

export function AccessGateScreen({
  reason,
  onLogout,
  email,
  tenantName,
}: {
  reason: keyof typeof GATE_COPY;
  onLogout: () => void;
  email?: string;
  tenantName?: string;
}) {
  const copy = GATE_COPY[reason];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-doqyn-bg px-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-doqyn-text">{copy.title}</h1>
        <p className="text-sm text-doqyn-muted">{copy.message}</p>
        {reason === 'pending' && (email || tenantName) && (
          <div className="mt-4 rounded-md border border-doqyn-border bg-doqyn-surface p-3 text-left text-xs text-doqyn-muted">
            {email && <p>E-mail: {email}</p>}
            {tenantName && <p>Cliente: {tenantName}</p>}
            <p className="mt-1">Status: pendente</p>
          </div>
        )}
      </div>
      <Button type="button" variant="secondary" onClick={onLogout}>
        Sair
      </Button>
    </div>
  );
}
