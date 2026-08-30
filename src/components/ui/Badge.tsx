import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Etiqueta do DOQYN — três formas, e a forma é que carrega o peso:
 *
 * · **contorno de fio** (neutro, ativo, informação): o estado apenas informa,
 *   então marca com fio de 1px e um tique quadrado da cor do estado;
 * · **etiqueta preenchida** (atenção, erro): preenchimento é reservado ao que
 *   pede decisão — é o que separa "está tudo certo" de "olhe para isto";
 * · **selo** (assinado, verificado): latão, contorno de 1px, nunca preenchido,
 *   e a única forma redonda do sistema.
 *
 * O texto é monoespaçado em caixa alta porque etiqueta é rótulo de registro,
 * não frase. Quem precisa de nome próprio dentro da etiqueta (categoria,
 * arquivo) passa `normal-case`.
 */
const badgeVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[2px] font-mono font-medium uppercase leading-none tracking-[0.08em] transition-colors duration-[var(--transition-duration-fast)]',
  {
    variants: {
      variant: {
        default: 'border border-doqyn-border-subtle text-doqyn-muted',
        neutral: 'border border-doqyn-border-subtle text-doqyn-muted',
        primary: 'border border-doqyn-border-strong text-doqyn-text',
        brand: 'border border-doqyn-accent-active/45 text-doqyn-primary',
        success: 'border border-doqyn-success-border text-doqyn-success',
        info: 'border border-doqyn-info-border text-doqyn-info',
        pending: 'border border-doqyn-pending-border text-doqyn-pending',
        warning: 'bg-doqyn-warning-bg text-doqyn-warning',
        danger: 'bg-doqyn-danger-bg text-doqyn-danger',
        seal: 'rounded-full border border-[var(--seal)] text-[var(--seal)]',
      },
      size: {
        xs: 'h-[18px] min-h-[18px] px-1.5 text-micro',
        sm: 'h-5 min-h-5 px-2 text-micro',
        md: 'h-6 min-h-6 px-2.5 text-caption',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

/** Tique quadrado — o redondo do sistema pertence só ao selo. */
const markVariants: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  default: 'bg-doqyn-neutral-dot',
  neutral: 'bg-doqyn-neutral-dot',
  primary: 'bg-doqyn-accent-active',
  brand: 'bg-doqyn-accent-active',
  success: 'bg-doqyn-success-dot',
  info: 'bg-doqyn-info-dot',
  pending: 'bg-doqyn-pending-dot',
  warning: '',
  danger: '',
  seal: 'bg-[var(--seal)]',
};

/** Preenchidas não levam tique: o preenchimento já é a marca. */
const FILLED_VARIANTS = new Set(['warning', 'danger']);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Mostra o tique do estado à esquerda do rótulo. */
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const resolvedVariant = variant ?? 'default';
  const resolvedSize = size ?? 'sm';
  const showMark = dot && !FILLED_VARIANTS.has(resolvedVariant);

  return (
    <span
      className={cn(badgeVariants({ variant: resolvedVariant, size: resolvedSize }), className)}
      {...props}
    >
      {showMark && (
        <span className={cn('h-1 w-1 shrink-0', markVariants[resolvedVariant])} aria-hidden />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

export { badgeVariants };
