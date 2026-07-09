import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'badge-text inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors duration-[var(--transition-duration-fast)]',
  {
    variants: {
      variant: {
        default: 'border-doqyn-neutral-border bg-doqyn-neutral-bg text-doqyn-neutral',
        primary: 'border-doqyn-border-strong bg-doqyn-primary-soft text-doqyn-text',
        success: 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success',
        warning: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
        danger: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
        info: 'border-doqyn-info-border bg-doqyn-info-bg text-doqyn-info',
        pending: 'border-doqyn-pending-border bg-doqyn-pending-bg text-doqyn-pending',
        neutral: 'border-doqyn-neutral-border bg-doqyn-neutral-bg text-doqyn-neutral',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const dotVariants: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  default: 'bg-doqyn-neutral-dot',
  primary: 'bg-doqyn-text',
  success: 'bg-doqyn-success-dot',
  warning: 'bg-doqyn-warning-dot',
  danger: 'bg-doqyn-danger-dot',
  info: 'bg-doqyn-info-dot',
  pending: 'bg-doqyn-pending-dot',
  neutral: 'bg-doqyn-neutral-dot',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant = 'default', dot = false, children, ...props }: BadgeProps) {
  const resolvedVariant = variant ?? 'default';

  return (
    <span className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props}>
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotVariants[resolvedVariant])}
          aria-hidden
        />
      )}
      <span>{children}</span>
    </span>
  );
}
