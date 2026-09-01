import { useIsFetching } from '@tanstack/react-query';
import { GlobalSearchCommand } from './GlobalSearchCommand';
import { HeaderUserMenu } from './HeaderUserMenu';
import { HelpMenu } from './HelpMenu';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationsBell } from '@/features/notifications/components/NotificationsBell';

/** Barra superior — fio de separação, busca contida e glifos soltos. */
export function WorkspaceTopBar() {
  const iconButtonClass = 'topbar-glyph-btn';
  const documentsFetching = useIsFetching({ queryKey: ['documents'] }) > 0;

  return (
    <header
      // O recuo lateral sai do token (`.workspace-topbar`), não de classe
      // utilitária: empatados em especificidade, o `px-5` do Tailwind vencia por
      // ordem e a busca saía do prumo do painel.
      className="workspace-topbar sticky top-0 flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 sm:gap-4"
      data-testid="workspace-topbar"
    >
      {/* Largura total. Contida em 440px ela ficava perdida no meio da barra;
          a régua de ponta a ponta lê como pauta de documento, não como a
          cápsula preenchida que existia antes.

          No tema padrão a busca é a única coisa clara dentro da casca grafite:
          uma folha pousada na barra, do mesmo branco do painel de baixo. Ela
          redeclara a paleta de papel para si porque tudo que mora dentro dela —
          texto, ícone, marcador de atalho — precisa virar junto; se só o fundo
          clareasse, o texto continuaria claro sobre branco. Nos outros dois
          temas a casca já é da paleta do conteúdo e a regra não se aplica. */}
      <div className="topbar-search flex min-w-0 flex-1 items-center">
        <GlobalSearchCommand isFetching={documentsFetching} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <NotificationsBell className={iconButtonClass} />
        <HelpMenu className={iconButtonClass} />
        <ThemeToggle className="text-doqyn-subtle hover:text-doqyn-text" />
        {/* Fio curto separando os controles do bloco de identidade: são coisas
            de naturezas diferentes na mesma ponta da barra. */}
        <span aria-hidden className="mx-1 h-5 w-px bg-doqyn-border-subtle" />
        <HeaderUserMenu />
      </div>
    </header>
  );
}
