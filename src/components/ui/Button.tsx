import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
          'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      variant: {
        primary:
          'border border-doqyn-border-strong bg-doqyn-text font-medium text-doqyn-bg hover:bg-doqyn-muted',
        secondary:
          'border border-doqyn-border bg-doqyn-surface font-medium text-doqyn-muted hover:border-doqyn-border-strong hover:text-doqyn-text',
        ghost:
          'border border-transparent bg-transparent font-medium text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text',
        danger:
          'border border-doqyn-danger-border bg-doqyn-danger-bg font-medium text-doqyn-danger hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';
