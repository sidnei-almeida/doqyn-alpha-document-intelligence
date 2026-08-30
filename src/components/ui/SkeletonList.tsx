import { cn } from '@/lib/utils';

/**
 * O carregamento de uma lista — com a forma do que vem, não com uma roda girando.
 *
 * **Roda girando diz "espere"; esqueleto diz "é isto que está chegando".** A diferença aparece no
 * mesmo tempo de espera: quem vê o desenho da lista sabe que é uma lista, quantas linhas mais ou
 * menos, e que a tela não travou. É a mesma espera, lida como progresso em vez de silêncio.
 *
 * Existia em dois dialetos: a Biblioteca com `skeleton-line`, que pulsa devagar, e a Auditoria com
 * `animate-pulse` do Tailwind, que pisca mais rápido — lado a lado, pareciam dois estados
 * diferentes do sistema, quando são o mesmo.
 *
 * Fica de fora o carregamento que **não** é lista: botão esperando resposta, célula de tabela
 * salvando, visualizador abrindo um arquivo. Ali não há forma a antecipar, e a roda continua certa.
 */
export function SkeletonList({
  rows = 6,
  /** Reserva o quadrado da miniatura ou do avatar à esquerda. */
  media = false,
  /** Segunda linha menor, para listas que mostram título e detalhe. */
  twoLines = false,
  className,
  rowClassName,
  label = 'Carregando',
}: {
  rows?: number;
  media?: boolean;
  twoLines?: boolean;
  className?: string;
  rowClassName?: string;
  label?: string;
}) {
  return (
    <div className={className} role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-3 border-b border-doqyn-border-subtle/75 px-4 py-3',
            rowClassName,
          )}
        >
          {media && <div className="skeleton-line h-8 w-8 shrink-0 rounded-md bg-doqyn-card" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Larguras desiguais de propósito: barras idênticas leem como grade, não como texto. */}
            <div
              className="skeleton-line h-3 rounded bg-doqyn-card"
              style={{ width: `${[38, 52, 45, 60, 41, 49][index % 6]}%` }}
            />
            {twoLines && (
              <div
                className="skeleton-line h-2.5 rounded bg-doqyn-card"
                style={{ width: `${[22, 28, 25, 19, 30, 24][index % 6]}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
