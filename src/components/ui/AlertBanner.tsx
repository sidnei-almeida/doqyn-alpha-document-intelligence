import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AlertBannerVariant = 'error' | 'warning' | 'success' | 'info';

const VARIANT_STYLES: Record<
  AlertBannerVariant,
  { container: string; icon: string; Icon: typeof AlertCircle }
> = {
  error: {
    container: 'border-[var(--feedback-error-border)] bg-[var(--feedback-error-bg)]',
    icon: 'text-[var(--feedback-error-text)]',
    Icon: AlertCircle,
  },
  warning: {
    container: 'border-[var(--feedback-warning-border)] bg-[var(--feedback-warning-bg)]',
    icon: 'text-[var(--feedback-warning-text)]',
    Icon: AlertTriangle,
  },
  success: {
    container: 'border-[var(--feedback-success-border)] bg-[var(--feedback-success-bg)]',
    icon: 'text-[var(--feedback-success-text)]',
    Icon: CheckCircle2,
  },
  info: {
    container: 'border-[var(--feedback-info-border)] bg-[var(--feedback-info-bg)]',
    icon: 'text-doqyn-muted',
    Icon: Info,
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
  const Icon = styles.Icon;
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
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} strokeWidth={1.5} aria-hidden />
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
