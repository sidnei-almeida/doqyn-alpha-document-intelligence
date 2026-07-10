import { cn } from '@/lib/utils';
import { BRAND_ASSETS } from './brandAssets';

type AuthBrandLogoProps = {
  subtitle?: string;
  className?: string;
};

/**
 * Logo das telas públicas — mesmos assets PNG da sidebar expandida.
 */
export function AuthBrandLogo({ subtitle, className }: AuthBrandLogoProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)} aria-label="DOQYN">
      <div className="auth-brand-logo flex w-full max-w-[220px] items-center justify-center">
        <img
          src={BRAND_ASSETS.sidebarForDarkTheme}
          alt=""
          className="auth-brand-logo__img auth-brand-logo__img--dark-theme h-auto max-h-14 w-full object-contain"
          draggable={false}
        />
        <img
          src={BRAND_ASSETS.sidebarForLightTheme}
          alt=""
          className="auth-brand-logo__img auth-brand-logo__img--light-theme h-auto max-h-14 w-full object-contain"
          draggable={false}
        />
      </div>
      {subtitle ? (
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.24em] text-doqyn-logo-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
