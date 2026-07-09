import { cva } from 'class-variance-authority';

/** Variantes de botão — flat, discretas; acento azul contido. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-display text-label font-medium transition-[background-color,opacity,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/35 focus-visible:ring-offset-1 focus-visible:ring-offset-doqyn-bg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
  {
    variants: {
      variant: {
        primary:
          'border border-transparent bg-doqyn-accent-active font-medium text-doqyn-on-accent hover:bg-doqyn-accent-hover',
        secondary:
          'border border-doqyn-border-subtle bg-doqyn-surface font-medium text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text',
        outline:
          'border border-doqyn-border-subtle bg-transparent font-medium text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text',
        ghost:
          'border border-transparent bg-transparent font-medium text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text',
        danger:
          'border border-doqyn-danger-border bg-doqyn-danger-bg font-medium text-doqyn-danger hover:opacity-90',
        /** Ação principal do workspace (+ Novo) — flat, tokens por tema. */
        action:
          'rounded-new-button border-0 bg-doqyn-new-button font-medium text-doqyn-new-button-text shadow-none hover:bg-doqyn-new-button-hover active:bg-doqyn-new-button-active',
      },
      size: {
        sm: 'h-8 px-3 text-label',
        md: 'h-10 px-4 text-label',
        lg: 'h-11 px-5 text-label',
        icon: 'h-icon-btn w-icon-btn px-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);
