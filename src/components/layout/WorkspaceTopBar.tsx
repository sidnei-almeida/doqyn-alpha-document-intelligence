import { useIsFetching } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { GlobalSearchCommand } from './GlobalSearchCommand';
import { HeaderUserMenu } from './HeaderUserMenu';
import { ICON_SIZE } from '@/lib/iconDefaults';

/** Barra superior — busca protagonista, ações discretas e usuário à direita. */
export function WorkspaceTopBar() {
  const { t } = useTranslation('common');
  const iconButtonClass = 'explorer-icon-btn h-10 w-10';
  const documentsFetching = useIsFetching({ queryKey: ['documents'] }) > 0;

  return (
    <header
      className="workspace-topbar sticky top-0 flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 px-4 sm:gap-4 sm:px-5"
      data-testid="workspace-topbar"
    >
      <div className="flex min-w-0 flex-1 items-center">
        <GlobalSearchCommand isFetching={documentsFetching} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href="https://doqyn.com"
          target="_blank"
          rel="noreferrer"
          className={iconButtonClass}
          aria-label={t('help')}
        >
          <Icon name="help" size={ICON_SIZE.nav} />
        </a>
        <Link to="/settings" className={iconButtonClass} aria-label={t('settings')}>
          <Icon name="settings" size={ICON_SIZE.nav} />
        </Link>
        <HeaderUserMenu />
      </div>
    </header>
  );
}
