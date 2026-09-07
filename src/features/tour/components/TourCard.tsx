import { forwardRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { TourStep } from '../tourTypes';

type TourCardProps = {
  step: TourStep;
  index: number;
  total: number;
  onSkip: () => void;
  onPrevious: () => void;
  onNext: () => void;
  style: React.CSSProperties;
  titleId: string;
  bodyId: string;
};

/**
 * Régua de progresso — um traço por passo, o atual em acento.
 *
 * Não é barra nem pílula: o sistema marca posição com fio, e a contagem exata
 * fica no monoespaçado ao lado. Quem quer o número lê o número; quem quer só a
 * noção de "quanto falta" lê os traços.
 */
function TourRuler({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: total }, (_, position) => (
        <span
          key={position}
          className={cn(
            'h-[2px] w-3.5 transition-colors duration-200',
            position < index && 'bg-doqyn-border-strong',
            position === index && 'bg-doqyn-accent-active',
            position > index && 'bg-doqyn-border-subtle',
          )}
        />
      ))}
    </div>
  );
}

export const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard(
  { step, index, total, onSkip, onPrevious, onNext, style, titleId, bodyId },
  ref,
) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="tour-card pointer-events-auto fixed"
      style={style}
      data-testid="tour-card"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <div className="flex items-center gap-3">
          <TourRuler index={index} total={total} />
          <span className="font-mono text-[10px] uppercase tabular-nums tracking-[0.14em] text-doqyn-subtle">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="explorer-interactive -mr-1.5 flex h-7 w-7 items-center justify-center rounded-[4px] text-doqyn-subtle transition-colors hover:bg-doqyn-hover/60 hover:text-doqyn-text"
          aria-label="Fechar o tour"
        >
          <Icon name="close" size={ICON_SIZE.sm} />
        </button>
      </div>

      <div className="px-5 pb-5 pt-3">
        <h2 id={titleId} className="font-display text-[17px] leading-snug text-doqyn-text">
          {step.title}
        </h2>
        {/* A régua curta sob o título é a mesma marca do cartão de link e do
            cabeçalho de página: separa sem desenhar caixa. */}
        <span aria-hidden className="mt-2.5 block h-px w-9 bg-doqyn-accent-active" />
        <p id={bodyId} className="mt-3.5 text-body leading-relaxed text-doqyn-muted">
          {step.body}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-doqyn-border-subtle px-5 py-3">
        <button
          type="button"
          onClick={onSkip}
          className="explorer-interactive text-caption text-doqyn-subtle transition-colors hover:text-doqyn-text"
        >
          {isLast ? 'Fechar' : 'Pular'}
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={onPrevious}>
              Voltar
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onNext} autoFocus>
            {isLast ? 'Concluir' : 'Avançar'}
            {!isLast && <Icon name="arrow_forward" size={ICON_SIZE.xs} />}
          </Button>
        </div>
      </div>
    </div>
  );
});
