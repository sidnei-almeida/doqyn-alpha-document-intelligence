import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]',
  {
    variants: {
      variant: {
        default: 'border-doqyn-border bg-doqyn-card text-doqyn-muted',
        primary: 'border-doqyn-primary/20 bg-doqyn-primary-soft text-doqyn-text',
        success: 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success',
        warning: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
        danger: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
        info: 'border-doqyn-border bg-doqyn-card text-doqyn-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
