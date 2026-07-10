import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'badge-text inline-flex shrink-0 items-center justify-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap transition-colors duration-[var(--transition-duration-fast)]',
  {
    variants: {
      variant: {
        default: 'border-doqyn-neutral-border bg-doqyn-neutral-bg text-doqyn-neutral',
        primary: 'border-doqyn-border-strong bg-doqyn-primary-soft text-doqyn-text',
        brand:
          'border-[color-mix(in_srgb,var(--new-button-bg)_36%,transparent)] bg-[color-mix(in_srgb,var(--new-button-bg)_16%,transparent)] text-[color-mix(in_srgb,var(--sidebar-selected-icon)_90%,white)]',
        success: 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success',
        warning: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
        danger: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
        info: 'border-doqyn-info-border bg-doqyn-info-bg text-doqyn-info',
        pending: 'border-doqyn-pending-border bg-doqyn-pending-bg text-doqyn-pending',
        neutral: 'border-doqyn-neutral-border bg-doqyn-neutral-bg text-doqyn-neutral',
      },
      size: {
        xs: 'h-[18px] min-h-[18px] px-1.5 text-[10px]',
        sm: 'h-5 min-h-5 px-2 text-[11px]',
        md: 'h-6 min-h-6 px-2.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

const dotVariants: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  default: 'bg-doqyn-neutral-dot',
  primary: 'bg-doqyn-accent-active',
  brand: 'bg-[var(--new-button-bg)]',
  success: 'bg-doqyn-success-dot',
  warning: 'bg-doqyn-warning-dot',
  danger: 'bg-doqyn-danger-dot',
  info: 'bg-doqyn-info-dot',
  pending: 'bg-doqyn-pending-dot',
  neutral: 'bg-doqyn-neutral-dot',
};

const dotSize: Record<NonNullable<VariantProps<typeof badgeVariants>['size']>, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const resolvedVariant = variant ?? 'default';
  const resolvedSize = size ?? 'sm';

  return (
    <span
      className={cn(badgeVariants({ variant: resolvedVariant, size: resolvedSize }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn('shrink-0 rounded-full', dotSize[resolvedSize], dotVariants[resolvedVariant])}
          aria-hidden
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

export { badgeVariants };
