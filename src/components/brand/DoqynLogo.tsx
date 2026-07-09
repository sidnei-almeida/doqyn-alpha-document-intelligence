import { cn } from '@/lib/utils';
import { DoqynMark } from './DoqynMark';

export type DoqynLogoVariant = 'horizontal' | 'vertical' | 'mark' | 'wordmark';
export type DoqynLogoSize = 'sm' | 'md' | 'lg' | 'sidebar' | 'login';

type DoqynLogoProps = {
  variant?: DoqynLogoVariant;
  size?: DoqynLogoSize;
  align?: 'left' | 'center';
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
  /** @deprecated Use variant="mark" — mantido para compatibilidade */
  showMark?: boolean;
};

const markSize: Record<DoqynLogoSize, number> = {
  sm: 22,
  md: 28,
  lg: 34,
  sidebar: 32,
  login: 48,
};

const wordmarkClass: Record<DoqynLogoSize, string> = {
  sm: 'text-[13px] tracking-[0.26em]',
  md: 'text-[16px] tracking-[0.28em]',
  lg: 'text-[19px] tracking-[0.3em]',
  sidebar: 'text-[17px] tracking-[0.3em]',
  login: 'text-[27px] tracking-[0.32em]',
};

const subtitleSize: Record<DoqynLogoSize, string> = {
  sm: 'mt-1 text-[8px] tracking-[0.22em]',
  md: 'mt-1.5 text-[9px] tracking-[0.24em]',
  lg: 'mt-2 text-[10px] tracking-[0.26em]',
  sidebar: 'mt-1 text-[8px] tracking-[0.22em]',
  login: 'mt-3 text-[11px] tracking-[0.28em]',
};

function resolveVariant(variant: DoqynLogoVariant | undefined, showMark?: boolean): DoqynLogoVariant {
  if (variant) return variant;
  if (showMark === false) return 'wordmark';
  return 'horizontal';
}

/**
 * Logo DOQYN desenhada em código (SVG + wordmark tipográfico) — adapta-se
 * automaticamente a dark e light via tokens (--logo-text).
 */
export function DoqynLogo({
  variant,
  size = 'md',
  align = 'left',
  showSubtitle = false,
  subtitle = 'SHARE. CONTROL. TRUST.',
  className,
  showMark,
}: DoqynLogoProps) {
  const resolvedVariant = resolveVariant(variant, showMark);

  const mark = <DoqynMark size={markSize[size]} className="shrink-0" />;

  const wordmark = (
    <span
      className={cn(
        'font-display font-medium uppercase leading-none text-doqyn-logo',
        wordmarkClass[size],
      )}
    >
      DOQYN
    </span>
  );

  const lockup =
    resolvedVariant === 'mark' ? (
      mark
    ) : resolvedVariant === 'wordmark' ? (
      wordmark
    ) : resolvedVariant === 'vertical' ? (
      <span className="flex flex-col items-center gap-2">
        {mark}
        {wordmark}
      </span>
    ) : (
      <span className="flex items-center gap-2.5">
        {mark}
        {wordmark}
      </span>
    );

  const subtitleEl = showSubtitle ? (
    <span
      className={cn(
        'font-medium uppercase text-doqyn-logo-muted',
        subtitleSize[size],
        align === 'center' && 'text-center',
      )}
    >
      {subtitle}
    </span>
  ) : null;

  return (
    <div
      className={cn(
        'flex select-none leading-none',
        align === 'center' ? 'flex-col items-center text-center' : 'flex-col items-start',
        className,
      )}
      aria-label="DOQYN"
    >
      {lockup}
      {subtitleEl}
    </div>
  );
}
