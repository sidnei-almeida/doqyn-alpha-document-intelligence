import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Link } from 'react-router-dom';
import { AuthCard, AuthShell } from '@/components/layout/AuthShell';
import { cn } from '@/lib/utils';

function AccessOptionCard({
  to,
  title,
  subtitle,
  icon,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-doqyn-border bg-doqyn-surface p-4',
        'transition-colors hover:border-doqyn-border-strong hover:bg-doqyn-bg',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-doqyn-border bg-doqyn-bg text-doqyn-text">
        <Icon name={icon} size={ICON_SIZE.xs} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-doqyn-text group-hover:underline">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-doqyn-muted">{subtitle}</span>
      </span>
    </Link>
  );
}

export function AccessChoicePage({
  eyebrow = 'Primeiro acesso',
  title,
  description = 'Escolha como deseja começar no DOQYN.',
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
} = {}) {
  return (
    <AuthShell
      width="md"
      eyebrow={eyebrow}
      title={title ?? 'Como você quer começar?'}
      description={description}
      footer={
        <Link to="/login" className="text-doqyn-muted transition-colors hover:text-doqyn-text">
          Já tenho conta — entrar
        </Link>
      }
    >
      <div className="space-y-2.5">
        <AccessOptionCard
          to="/solicitar-acesso"
          title="Pedir acesso à minha empresa"
          subtitle="Para funcionários de uma empresa que já usa o DOQYN."
          icon="person_add"
        />
        <AccessOptionCard
          to="/criar-empresa"
          title="Cadastrar minha empresa"
          subtitle="Para criar um novo ambiente da empresa no DOQYN."
          icon="business"
        />
        <AccessOptionCard
          to="/criar-acesso-cpf"
          title="Acessar como pessoa física"
          subtitle="Para clientes CPF que precisam acessar documentos próprios no DOQYN."
          icon="person"
        />
      </div>
    </AuthShell>
  );
}
