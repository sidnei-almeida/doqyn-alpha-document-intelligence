import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import {
  dropdownMenuItemClass,
  dropdownMenuItemDangerClass,
  dropdownMenuItemSelectedClass,
} from './dropdownMenuStyles';

export type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  tone?: 'default' | 'danger';
  itemRole?: 'option' | 'menuitem';
};

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ selected = false, tone = 'default', itemRole = 'option', className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role={itemRole}
      aria-selected={itemRole === 'option' ? selected : undefined}
      className={cn(
        dropdownMenuItemClass,
        selected && dropdownMenuItemSelectedClass,
        tone === 'danger' && dropdownMenuItemDangerClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';
