import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-xl border border-doqyn-border-subtle bg-doqyn-surface shadow-elevation-1 transition-[background-color,border-color,box-shadow] duration-[var(--transition-duration)] ease-[var(--ease-standard)]',
  {
    variants: {
      variant: {
        default: '',
        metric: 'hover:border-doqyn-border hover:bg-doqyn-surface-hover hover:shadow-card-hover',
        content: '',
        interactive:
          'cursor-pointer hover:border-doqyn-border hover:bg-doqyn-surface-hover hover:shadow-card-hover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 p-4 pb-0', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardEyebrow = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('eyebrow-text', className)} {...props} />
  ),
);
CardEyebrow.displayName = 'CardEyebrow';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('card-title', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('caption-text', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

export type ContentCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ContentCard({
  title,
  eyebrow,
  description,
  headerAction,
  children,
  className,
  contentClassName,
}: ContentCardProps) {
  return (
    <Card variant="content" className={className}>
      <CardHeader
        className={headerAction ? 'flex-row items-start justify-between gap-3' : undefined}
      >
        <div className="min-w-0">
          {eyebrow && <CardEyebrow className="mb-1">{eyebrow}</CardEyebrow>}
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export type MetricCardProps = {
  label: string;
  value: number | string;
  subtext?: string;
  onClick?: () => void;
  className?: string;
  /** `default` para KPIs principais; `compact` para tiles densos (ex.: governança). */
  layout?: 'default' | 'compact';
};

export function MetricCard({
  label,
  value,
  subtext,
  onClick,
  className,
  layout = 'default',
}: MetricCardProps) {
  const isCompact = layout === 'compact';

  return (
    <Card
      variant={onClick ? 'interactive' : 'metric'}
      className={cn('flex h-full flex-col', isCompact ? 'min-h-0' : 'min-h-[7.5rem]', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardContent
        className={cn('flex flex-1 flex-col', isCompact ? 'gap-1 p-3' : 'justify-between p-4')}
      >
        <p className="eyebrow-text shrink-0">{label}</p>
        {isCompact ? (
          <p className="type-display text-doqyn-text">{value}</p>
        ) : (
          <p className="type-display flex flex-1 items-center text-doqyn-text">{value}</p>
        )}
        {!isCompact && (
          <p className={cn('caption-text shrink-0', !subtext && 'invisible')}>
            {subtext || '\u00a0'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
