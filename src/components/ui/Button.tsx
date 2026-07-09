import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { buttonVariants } from './buttonVariants';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, title, ...props }, ref) => {
    const button = (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );

    if (title) {
      return <Tooltip label={title}>{button}</Tooltip>;
    }

    return button;
  },
);
Button.displayName = 'Button';
