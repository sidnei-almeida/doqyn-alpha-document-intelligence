import { cn } from '@/lib/utils';

/** Item de menu/popover — alinhado ao design system DOQYN. */
export const dropdownMenuItemClass = cn(
  'explorer-interactive type-label flex w-full items-center rounded-lg px-3 py-2 text-left text-doqyn-text',
  'transition-colors duration-[var(--transition-duration-fast)]',
  'hover:bg-doqyn-surface-hover active:scale-[0.99]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-inset',
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
);

export const dropdownMenuItemSelectedClass = 'bg-doqyn-selected font-medium text-doqyn-text';

export const dropdownMenuItemDangerClass = 'text-doqyn-danger hover:bg-doqyn-danger-bg/30';
