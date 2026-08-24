import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { DoqynMark } from '@/components/brand/DoqynMark';
import { AntechamberDocument } from '@/features/auth/components/AntechamberDocument';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

/**
 * Largura da coluna do formulário, por rota.
 *
 * Vive aqui, e não em cada tela, porque é conhecimento de layout: o login pede
 * coluna estreita e os cadastros pedem espaço. Deixar cada tela declarar a
 * própria largura foi o que produziu, na casca antiga, um `width="md"` em todas
 * elas por falta de critério.
 */
const COLUMN_WIDTH: Record<string, string> = {
  '/login': 'max-w-[368px]',
  '/acesso': 'max-w-[452px]',
  '/solicitar-acesso': 'max-w-[520px]',
  '/criar-empresa': 'max-w-[520px]',
  '/criar-acesso-cpf': 'max-w-[520px]',
};

/**
 * Casca da porta de entrada — "a antessala".
 *
 * É **rota de layout**, não componente de página: o painel do documento fica
 * montado enquanto a pessoa circula entre entrar, escolher como começar e se
 * cadastrar. Se cada tela montasse a própria casca, a leitura de três segundos
 * reiniciaria a cada navegação — insuportável para quem só quer voltar ao login.
 *
 * Só a coluna da direita transiciona, com a chave em `pathname`.
 *
 * Abaixo de 1024px o painel some e o formulário assume a tela inteira: numa
 * largura de celular, o documento viraria enfeite ilegível.
 */
export function AuthSplitShell() {
  const location = useLocation();
  const width = COLUMN_WIDTH[location.pathname] ?? 'max-w-[452px]';

  return (
    <main className="relative grid min-h-screen bg-doqyn-bg lg:grid-cols-[1.15fr_1fr]">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* painel do produto — persiste entre as telas */}
      <section className="relative hidden overflow-hidden border-r border-doqyn-border-subtle bg-doqyn-panel lg:block">
        <AntechamberDocument />
      </section>

      {/* coluna do formulário */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className={cn('w-full', width)}>
          <span className="auth-stage auth-stage--mark flex items-center gap-2.5">
            <DoqynMark size={26} className="shrink-0 text-doqyn-accent-active" />
            <span className="font-display text-[17px] font-medium uppercase leading-none tracking-[0.16em] text-doqyn-text">
              Doqyn
            </span>
          </span>

          {/* a chave troca a cada rota, então o conteúdo entra de novo */}
          <div key={location.pathname} className="auth-route">
            <Outlet />
          </div>

          <p className="auth-stage auth-stage--foot mt-9 flex items-center gap-1.5 text-micro text-doqyn-subtle">
            <Icon name="shield" size={ICON_SIZE.xs} />
            Ambiente corporativo seguro
          </p>
        </div>
      </section>
    </main>
  );
}

/**
 * Cabeçalho de uma tela da antessala. Cada tela declara o próprio título, já
 * que todas dividem a mesma casca.
 */
export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8 mt-9 flex flex-col gap-2.5">
      <h1 className="text-balance font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.014em] text-doqyn-text">
        {title}
      </h1>
      {description ? (
        <p className="max-w-[46ch] text-caption leading-relaxed text-doqyn-muted">{description}</p>
      ) : null}
    </div>
  );
}

/** Rodapé de navegação entre as telas da antessala. */
export function AuthFooterLink({ children }: { children: ReactNode }) {
  return <div className="mt-8 text-caption text-doqyn-muted">{children}</div>;
}
