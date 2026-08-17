import { cva } from 'class-variance-authority';

/** Variantes de botão — CTAs usam o índigo do + Novo (legível em dark e light). */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-display text-label font-medium',
    'transition-[background-color,border-color,color,opacity,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/35 focus-visible:ring-offset-1 focus-visible:ring-offset-doqyn-bg',
    'active:scale-[0.98]',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:active:scale-100',
  ].join(' '),
  {
    variants: {
      variant: {
        /** CTA principal — mesmo padrão visual do + Novo (índigo + texto branco). */
        primary:
          'rounded-new-button border-0 bg-doqyn-new-button text-doqyn-new-button-text shadow-none hover:bg-doqyn-new-button-hover active:bg-doqyn-new-button-active disabled:bg-doqyn-card disabled:text-doqyn-subtle',
        secondary:
          'border border-doqyn-border-subtle bg-doqyn-surface text-doqyn-muted hover:border-doqyn-border hover:bg-doqyn-surface-hover hover:text-doqyn-text disabled:border-doqyn-border-subtle disabled:bg-doqyn-surface disabled:text-doqyn-subtle',
        outline:
          'border border-doqyn-border-subtle bg-transparent text-doqyn-muted hover:border-doqyn-border hover:bg-doqyn-surface-hover hover:text-doqyn-text disabled:border-doqyn-border-subtle disabled:bg-transparent disabled:text-doqyn-subtle',
        ghost:
          'border border-transparent bg-transparent text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text disabled:bg-transparent disabled:text-doqyn-subtle',
        danger:
          'border border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger hover:bg-doqyn-danger-bg/80 disabled:border-doqyn-border-subtle disabled:bg-doqyn-surface disabled:text-doqyn-subtle',
        /** Alias do primary — mantido para o botão + Novo e CTAs de workspace. */
        action:
          'rounded-new-button border-0 bg-doqyn-new-button text-doqyn-new-button-text shadow-none hover:bg-doqyn-new-button-hover active:bg-doqyn-new-button-active disabled:bg-doqyn-card disabled:text-doqyn-subtle',
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
