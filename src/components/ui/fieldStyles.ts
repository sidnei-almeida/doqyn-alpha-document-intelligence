import { cn } from '@/lib/utils';

/** Altura e padding compartilhados entre Input, Select e DateInput. */
export const FIELD_CONTROL_HEIGHT = 'h-10';

export const fieldControlClass = cn(
  FIELD_CONTROL_HEIGHT,
  'type-body w-full rounded-lg border border-doqyn-border-subtle bg-doqyn-surface px-3.5 text-doqyn-text',
  'placeholder:text-doqyn-disabled transition-[border-color,box-shadow] duration-[var(--transition-duration)] ease-[var(--ease-standard)]',
  'hover:border-doqyn-border',
  'focus-visible:border-doqyn-accent-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/25 focus-visible:ring-offset-0',
  'disabled:cursor-not-allowed disabled:opacity-40',
);

export const fieldLabelClass = 'type-label text-doqyn-muted';

export const fieldWrapperClass = 'flex flex-col gap-1.5';
