import type { TourCardPlacement, TourRect } from './tourTypes';

export const TOUR_CARD_WIDTH = 352;
/** Folga entre o recorte e o cartão. */
const GAP = 18;
/** Respiro mínimo até a borda da janela. */
const EDGE = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Onde pousar o cartão em relação ao recorte.
 *
 * A ordem é lateral antes de vertical porque quase todo alvo do roteiro é um
 * item de rail ou uma tabela larga: acima ou abaixo deles o cartão empurraria o
 * próprio recorte para fora da janela. Se nenhum dos quatro lados couber, o
 * cartão vai para o centro e o recorte continua marcado — melhor sobrepor um
 * pouco do que sair da tela.
 */
export function placeTourCard(
  rect: TourRect | null,
  cardHeight: number,
): { top: number; left: number; width: number; placement: TourCardPlacement } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const height = cardHeight || 220;
  // Em tela estreita o cartão não tem lado para onde ir; ele encolhe até a
  // largura da janela menos a margem e cai no centro pelo caminho normal.
  const width = Math.min(TOUR_CARD_WIDTH, viewportWidth - EDGE * 2);

  if (!rect) {
    return {
      top: Math.max(EDGE, (viewportHeight - height) / 2),
      left: Math.max(EDGE, (viewportWidth - width) / 2),
      width,
      placement: 'center',
    };
  }

  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  const fitsRight = right + GAP + width + EDGE <= viewportWidth;
  const fitsLeft = rect.left - GAP - width - EDGE >= 0;
  const fitsBelow = bottom + GAP + height + EDGE <= viewportHeight;
  const fitsAbove = rect.top - GAP - height - EDGE >= 0;

  const verticalTop = clamp(
    rect.top + rect.height / 2 - height / 2,
    EDGE,
    Math.max(EDGE, viewportHeight - height - EDGE),
  );
  const horizontalLeft = clamp(
    rect.left + rect.width / 2 - width / 2,
    EDGE,
    Math.max(EDGE, viewportWidth - width - EDGE),
  );

  if (fitsRight) return { top: verticalTop, left: right + GAP, width, placement: 'right' };
  if (fitsLeft) {
    return { top: verticalTop, left: rect.left - GAP - width, width, placement: 'left' };
  }
  if (fitsBelow) return { top: bottom + GAP, left: horizontalLeft, width, placement: 'bottom' };
  if (fitsAbove) {
    return { top: rect.top - GAP - height, left: horizontalLeft, width, placement: 'top' };
  }

  // Alvo grande demais para ter lado de fora — é o caso dos passos que acendem
  // a página inteira. Centralizar aqui punha o cartão sobre as primeiras
  // linhas da tabela, justamente o que o passo mandou olhar. O canto inferior
  // direito cobre a parte da tela que costuma estar vazia, e fica longe do
  // rail, que é por onde a leitura começa.
  return {
    top: Math.max(EDGE, viewportHeight - height - EDGE),
    left: Math.max(EDGE, viewportWidth - width - EDGE),
    width,
    placement: 'bottom',
  };
}
