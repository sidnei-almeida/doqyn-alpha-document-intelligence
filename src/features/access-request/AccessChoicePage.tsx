import { Building2, User, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DoqynLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function AccessOptionCard({
  to,
  title,
  subtitle,
  icon: Icon,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: typeof Building2;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-2 rounded-xl border border-doqyn-border bg-doqyn-surface p-5 transition-colors hover:border-doqyn-border-strong hover:bg-doqyn-bg"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-doqyn-border bg-doqyn-bg text-doqyn-text">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className="text-sm font-semibold text-doqyn-text group-hover:underline">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-doqyn-muted">{subtitle}</p>
    </Link>
  );
}

export function AccessChoicePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-doqyn-bg px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md flow-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoqynLogo size="lg" align="center" showSubtitle subtitle="Primeiro acesso" />
          <p className="mt-4 text-sm text-doqyn-muted">Escolha como deseja começar no DOQYN.</p>
        </div>

        <div className="space-y-3">
          <AccessOptionCard
            to="/solicitar-acesso"
            title="Pedir acesso à minha empresa"
            subtitle="Para funcionários de uma empresa que já usa o DOQYN."
            icon={UserPlus}
          />
          <AccessOptionCard
            to="/criar-empresa"
            title="Cadastrar minha empresa"
            subtitle="Para criar um novo ambiente da empresa no DOQYN."
            icon={Building2}
          />
          <AccessOptionCard
            to="/criar-acesso-cpf"
            title="Acessar como pessoa física"
            subtitle="Para clientes CPF que precisam acessar documentos próprios no DOQYN."
            icon={User}
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
