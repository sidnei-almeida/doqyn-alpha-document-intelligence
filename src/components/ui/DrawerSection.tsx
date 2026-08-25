import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DrawerSectionProps = {
  label: string;
  /** Conteúdo alinhado à direita do rótulo — versão, contagem, estado. */
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  'data-testid'?: string;
};

/**
 * Bloco de gaveta — abre com fio, não com moldura.
 *
 * As gavetas eram pilhas de cartões: cada assunto dentro de uma caixa de canto
 * arredondado e fundo próprio, dentro de outra caixa que já é a gaveta. Três
 * molduras aninhadas para separar o que o espaço e um fio já separam. Aqui o
 * bloco só abre com um fio e um rótulo de registro, como os painéis da Visão
 * Geral e as tabelas do sistema.
 */
export function DrawerSection({
  label,
  aside,
  className,
  bodyClassName,
  children,
  'data-testid': testId,
}: DrawerSectionProps) {
  return (
    <section
      className={cn('border-t border-doqyn-border-subtle pt-3', className)}
      data-testid={testId}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="register-label text-doqyn-subtle">{label}</p>
        {aside}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

type DrawerFieldProps = {
  label: string;
  value: ReactNode;
  /** Valores contáveis (datas, tamanhos, ids) ficam em monoespaçado. */
  mono?: boolean;
};

/** Linha de ficha — rótulo à esquerda, valor à direita, separados por fio. */
export function DrawerField({ label, value, mono = false }: DrawerFieldProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-doqyn-border-subtle/50 py-1.5 last:border-0">
      <dt className="shrink-0 text-caption text-doqyn-muted">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right',
          mono
            ? 'font-mono text-micro tabular-nums text-doqyn-text'
            : 'text-caption text-doqyn-text',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
