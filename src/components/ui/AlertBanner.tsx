import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

export type AlertBannerVariant = 'error' | 'warning' | 'success' | 'info';

const VARIANT_STYLES: Record<
  AlertBannerVariant,
  { container: string; icon: string; iconClass: string }
> = {
  error: {
    container: 'border-[var(--feedback-error-border)] bg-[var(--feedback-error-bg)]',
    icon: 'error',
    iconClass: 'text-[var(--feedback-error-text)]',
  },
  warning: {
    container: 'border-[var(--feedback-warning-border)] bg-[var(--feedback-warning-bg)]',
    icon: 'warning',
    iconClass: 'text-[var(--feedback-warning-text)]',
  },
  success: {
    container: 'border-[var(--feedback-success-border)] bg-[var(--feedback-success-bg)]',
    icon: 'check_circle',
    iconClass: 'text-[var(--feedback-success-text)]',
  },
  info: {
    container: 'border-[var(--feedback-info-border)] bg-[var(--feedback-info-bg)]',
    icon: 'info',
    iconClass: 'text-doqyn-muted',
  },
};

export function AlertBanner({
  variant = 'info',
  title,
  message,
  children,
  className,
}: {
  variant?: AlertBannerVariant;
  title?: string;
  message: string;
  children?: ReactNode;
  className?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  const isAlert = variant === 'error' || variant === 'warning';

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-lg border px-3 py-2.5 text-left',
        styles.container,
        className,
      )}
    >
      <Icon
        name={styles.icon}
        size={ICON_SIZE.sm}
        className={cn('mt-0.5 shrink-0', styles.iconClass)}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? (
          <p className="text-sm font-medium text-doqyn-text">{title}</p>
        ) : null}
        <p className={cn('text-sm', title ? 'text-doqyn-muted' : 'text-doqyn-text')}>{message}</p>
        {children}
      </div>
    </div>
  );
}
