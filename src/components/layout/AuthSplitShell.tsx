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
 * Rotas com parâmetro na URL, que não casam por igualdade.
 *
 * O convite é `/convite/:token`, então `COLUMN_WIDTH[pathname]` nunca acha — e a tela caía na
 * largura de 452px, estreita demais para um formulário que pede nome, senha, WhatsApp, cargo e
 * setor. Mesma medida dos outros cadastros, pelo mesmo motivo.
 */
const COLUMN_WIDTH_BY_PREFIX: Array<[string, string]> = [['/convite/', 'max-w-[520px]']];

function resolveColumnWidth(pathname: string): string {
  const exact = COLUMN_WIDTH[pathname];
  if (exact) return exact;
  const prefixed = COLUMN_WIDTH_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  return prefixed ? prefixed[1] : 'max-w-[452px]';
}

/**
 * Casca da porta de entrada — "a antessala".
 *
 * Duas camadas, como o workspace: a casca (`auth-chrome chrome-dark`) vale de
 * borda a borda e o painel do documento é um recorte dentro dela. É a mesma
 * anatomia que a pessoa encontra depois do login, e é ela que devolve mesa
 * escura à folha — a página tem sombra funda desenhada para separá-la do
 * fundo, e sobre uma antessala clara essa sombra não separava nada.
 *
 * A classe `chrome-dark` fica sempre na marcação e só vale no tema padrão: é o
 * CSS que decide, via `data-appearance`, então trocar de tema não remonta a
 * casca. No claro e no escuro as duas colunas voltam a ser uma superfície só.
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
  const width = resolveColumnWidth(location.pathname);

  return (
    <main className="auth-chrome chrome-dark relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* painel do produto — persiste entre as telas */}
      <section className="auth-canvas relative hidden lg:block">
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
