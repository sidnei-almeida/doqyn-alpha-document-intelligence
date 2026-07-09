import { cn } from '@/lib/utils';
import { BRAND_ASSETS } from './brandAssets';

type SidebarBrandLogoProps = {
  collapsed?: boolean;
  className?: string;
};

/**
 * Logo da sidebar — horizontal com wordmark quando expandida;
 * ícone isolado quando recolhida.
 */
export function SidebarBrandLogo({ collapsed = false, className }: SidebarBrandLogoProps) {
  if (collapsed) {
    return (
      <div
        className={cn('sidebar-brand-logo flex w-10 items-center justify-center', className)}
        aria-label="DOQYN"
      >
        <img
          src={BRAND_ASSETS.sidebarIcon}
          alt=""
          className="h-10 w-10 shrink-0 object-contain object-center"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'sidebar-brand-logo flex w-full items-center justify-center px-1',
        className,
      )}
      aria-label="DOQYN"
    >
      <img
        src={BRAND_ASSETS.sidebarForDarkTheme}
        alt=""
        className="sidebar-brand-logo__img sidebar-brand-logo__img--dark-theme h-auto w-full max-h-16 max-w-full object-contain object-center"
        draggable={false}
      />
      <img
        src={BRAND_ASSETS.sidebarForLightTheme}
        alt=""
        className="sidebar-brand-logo__img sidebar-brand-logo__img--light-theme h-auto w-full max-h-16 max-w-full object-contain object-center"
        draggable={false}
      />
    </div>
  );
}
