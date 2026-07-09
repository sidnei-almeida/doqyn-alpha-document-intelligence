import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className, children, type = 'button', ...props }, ref) => (
    <Tooltip label={label}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          'explorer-interactive explorer-focus-ring inline-flex h-icon-btn min-h-icon-btn w-icon-btn min-w-icon-btn shrink-0 items-center justify-center rounded-full',
          'text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text active:scale-95',
          'disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  ),
);
IconButton.displayName = 'IconButton';
