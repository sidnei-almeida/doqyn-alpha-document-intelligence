import { useIsFetching } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { GlobalSearchCommand } from './GlobalSearchCommand';
import { HeaderUserMenu } from './HeaderUserMenu';
import { ExpiryAlertsBell } from '@/features/expiry/components/ExpiryAlertsBell';
import { ICON_SIZE } from '@/lib/iconDefaults';

/** Barra superior — fio de separação, busca contida e glifos soltos. */
export function WorkspaceTopBar() {
  const iconButtonClass = 'topbar-glyph-btn';
  const documentsFetching = useIsFetching({ queryKey: ['documents'] }) > 0;

  return (
    <header
      className="workspace-topbar sticky top-0 flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 px-4 sm:gap-4 sm:px-5"
      data-testid="workspace-topbar"
    >
      {/* Largura total. Contida em 440px ela ficava perdida no meio da barra;
          a régua de ponta a ponta lê como pauta de documento, não como a
          cápsula preenchida que existia antes. */}
      <div className="flex min-w-0 flex-1 items-center">
        <GlobalSearchCommand isFetching={documentsFetching} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ExpiryAlertsBell className={iconButtonClass} />
        <a
          href="https://doqyn.com"
          target="_blank"
          rel="noreferrer"
          className={iconButtonClass}
          aria-label="Ajuda"
        >
          <Icon name="help" size={ICON_SIZE.nav} />
        </a>
        <HeaderUserMenu />
      </div>
    </header>
  );
}
