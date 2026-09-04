import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Link } from 'react-router-dom';
import { AuthFooterLink, AuthHeading } from '@/components/layout/AuthSplitShell';
import { AUTH_CHOICE_ROW } from '@/features/auth/components/authControls';

function AccessOption({
  to,
  index,
  title,
  subtitle,
}: {
  to: string;
  index: number;
  title: string;
  subtitle: string;
}) {
  return (
    <Link to={to} className={AUTH_CHOICE_ROW}>
      {/* A numeração é referência, não enfeite: são três caminhos excludentes e
          a pessoa escolhe um. Em monoespaçado, como todo rótulo de registro. */}
      <span className="font-mono text-micro tabular-nums text-doqyn-subtle transition-colors group-hover:text-doqyn-accent-active">
        {String(index).padStart(2, '0')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label font-medium text-doqyn-text">{title}</span>
        <span className="mt-1 block text-caption leading-relaxed text-doqyn-muted">{subtitle}</span>
      </span>
      <Icon
        name="arrow_forward"
        size={ICON_SIZE.xs}
        className="shrink-0 -translate-x-1 text-doqyn-subtle opacity-0 transition-all group-hover:translate-x-0 group-hover:text-doqyn-accent-active group-hover:opacity-100"
      />
    </Link>
  );
}

export function AccessChoicePage({
  title,
  // Sem descrição por padrão: "Escolha como deseja começar no DOQYN" só
  // reescrevia o título como afirmação. Quem chama pode passar uma frase que
  // acrescente algo.
  description,
}: {
  title?: string;
  description?: string;
} = {}) {
  return (
    <>
      <AuthHeading title={title ?? 'Como você quer começar?'} description={description} />

      <div className="border-t border-doqyn-border-subtle">
        <AccessOption
          to="/solicitar-acesso"
          index={1}
          title="Pedir acesso à minha empresa"
          subtitle="Para quem trabalha numa empresa que já usa o DOQYN."
        />
        <AccessOption
          to="/criar-empresa"
          index={2}
          title="Cadastrar minha empresa"
          subtitle="Para abrir um ambiente novo para a sua empresa."
        />
        <AccessOption
          to="/criar-acesso-cpf"
          index={3}
          title="Acessar como pessoa física"
          subtitle="Para quem guarda documentos próprios, sem empresa."
        />
      </div>

      <AuthFooterLink>
        Já tenho conta.{' '}
        <Link
          to="/login"
          className="text-doqyn-accent-active underline-offset-4 transition-colors hover:underline"
        >
          Entrar
        </Link>
      </AuthFooterLink>
    </>
  );
}
