import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayLayer, useStableCallback } from '@/components/ui/overlayStack';
import { placeTourCard } from '../tourPlacement';
import { useTour } from '../useTour';
import { useTourTargetRect } from '../useTourTargetRect';
import { TourCard } from './TourCard';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * O holofote e o cartão.
 *
 * O recorte não é um buraco em SVG: é um retângulo com `box-shadow` de raio
 * enorme, que escurece tudo o que está fora dele. Assim as quatro medidas do
 * furo são propriedades animáveis, e a passagem de um passo para o outro é uma
 * transição de CSS em vez de um redesenho — que era o que fazia o holofote
 * piscar entre elementos.
 *
 * Nada da página fica clicável durante o tour. É deliberado: o passo pode estar
 * apontando para um botão que abre um modal, e um clique ali deixaria a pessoa
 * dentro de um fluxo com o tour ainda correndo por cima.
 */
export function TourOverlay() {
  const { open, step, index, steps, next, previous, stop } = useTour();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);

  const isTopLayer = useOverlayLayer(open);
  const { rect } = useTourTargetRect(step?.target, open, step?.padding ?? 8, step?.id ?? '');

  // Medido depois de pintar: a altura do cartão muda com o tamanho do texto, e
  // é ela que decide se ainda cabe ao lado do alvo ou se o cartão desce.
  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const element = cardRef.current;
    const update = () => setCardHeight(element.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, step?.id]);

  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {
    if (!isTopLayer()) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      stop();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      previous();
      return;
    }
    // O clique já está bloqueado pela trava; o Tab não estava, e levava o foco
    // para dentro da página escurecida — de onde o Enter dispararia uma ação
    // que a pessoa não consegue ver.
    if (event.key === 'Tab' && cardRef.current) {
      const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (!cardRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // A página não rola por baixo do holofote: o furo ficaria para trás do alvo.
  // A rolagem que o próprio tour faz (scrollIntoView) acontece antes disto
  // importar, porque é programática.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !step) return null;

  const placement = placeTourCard(rect, cardHeight);

  return createPortal(
    <div className="tour-root" data-testid="tour-overlay">
      {/* Trava de cliques. Fica abaixo do recorte para que o escurecimento
          continue sendo desenhado pelo `box-shadow` e não por duas camadas
          escuras somadas. */}
      <div className="tour-blocker" onMouseDown={(event) => event.preventDefault()} />

      <div
        className="tour-spotlight"
        data-has-target={rect ? 'true' : 'false'}
        style={
          rect
            ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            : {
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
                width: 0,
                height: 0,
              }
        }
      />

      <TourCard
        ref={cardRef}
        step={step}
        index={index}
        total={steps.length}
        onSkip={stop}
        onPrevious={previous}
        onNext={next}
        titleId={titleId}
        bodyId={bodyId}
        style={{ top: placement.top, left: placement.left, width: placement.width }}
      />
    </div>,
    document.body,
  );
}
