import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Link } from 'react-router-dom';
import { DoqynLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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
      className="group flex flex-col gap-2 rounded-xl border border-doqyn-border bg-doqyn-surface p-5 transition-colors hover:border-doqyn-border-strong hover:bg-doqyn-bg"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-doqyn-border bg-doqyn-bg text-doqyn-text">
          <Icon name={icon} size={ICON_SIZE.xs} />
        </span>
        <span className="text-sm font-semibold text-doqyn-text group-hover:underline">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-doqyn-muted">{subtitle}</p>
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
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="login" variant="horizontal" align="center" showSubtitle subtitle={eyebrow} />
          <h1 className="mt-4 text-base font-semibold text-doqyn-text">
            {title ?? 'Como você quer começar?'}
          </h1>
          <p className="mt-2 text-sm text-doqyn-muted">{description}</p>
        </div>

        <div className="space-y-3">
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

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-doqyn-muted transition-colors hover:text-doqyn-text">
            Já tenho conta — entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
