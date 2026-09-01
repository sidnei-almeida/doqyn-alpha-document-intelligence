import { useEffect, useRef, useState } from 'react';
import type { TourRect } from './tourTypes';

const DEFAULT_PADDING = 8;
/** Quanto esperar o alvo aparecer antes de desistir e centralizar o cartão. */
const RESOLVE_TIMEOUT_MS = 2000;

function firstVisible(selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const candidates = document.querySelectorAll<HTMLElement>(selector);
    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      // Elemento montado mas sem caixa (aba escondida, seção recolhida) não
      // serve de alvo: o holofote recortaria um retângulo de zero por zero.
      if (rect.width > 0 && rect.height > 0) return element;
    }
  }
  return null;
}

function isOutOfView(rect: DOMRect): boolean {
  return rect.top < 72 || rect.bottom > window.innerHeight - 72;
}

function measure(element: HTMLElement, padding: number): TourRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

/**
 * Acompanha o retângulo do alvo do passo enquanto ele estiver ativo.
 *
 * O alvo é procurado em laço, e não uma vez só: entre trocar de rota e o
 * elemento existir há o carregamento da rota (todas são `lazy`) e a primeira
 * busca de dados. Medir uma vez no efeito pegaria a tela ainda vazia.
 *
 * Devolve `null` quando o alvo não apareceu no tempo previsto — aí o cartão
 * nasce centralizado, e o passo continua legível mesmo sem holofote.
 */
export function useTourTargetRect(
  selectors: readonly string[] | undefined,
  active: boolean,
  padding = DEFAULT_PADDING,
  /** Muda a cada passo: força o laço a recomeçar mesmo com o mesmo seletor. */
  stepKey: string,
): { rect: TourRect | null; resolved: boolean } {
  const [rect, setRect] = useState<TourRect | null>(null);
  const [resolved, setResolved] = useState(false);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!active || !selectors || selectors.length === 0) {
      setRect(null);
      setResolved(true);
      return;
    }

    setResolved(false);
    let cancelled = false;
    let element: HTMLElement | null = null;
    let scrolled = false;
    const startedAt = performance.now();

    const tick = () => {
      if (cancelled) return;

      if (!element) {
        element = firstVisible(selectors);
        if (!element) {
          if (performance.now() - startedAt > RESOLVE_TIMEOUT_MS) {
            setRect(null);
            setResolved(true);
            return;
          }
          frameRef.current = requestAnimationFrame(tick);
          return;
        }
      }

      // Só uma vez: rolar a cada quadro brigaria com a rolagem suave em curso.
      if (!scrolled) {
        scrolled = true;
        if (isOutOfView(element.getBoundingClientRect())) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }

      // O elemento pode sair da árvore no meio do passo (a lista recarregou,
      // a rota trocou). Voltar a procurar é mais barato que congelar o furo
      // num lugar onde não há mais nada.
      if (!element.isConnected) {
        element = null;
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const next = measure(element, padding);
      setRect((current) =>
        current &&
        Math.abs(current.top - next.top) < 0.5 &&
        Math.abs(current.left - next.left) < 0.5 &&
        Math.abs(current.width - next.width) < 0.5 &&
        Math.abs(current.height - next.height) < 0.5
          ? current
          : next,
      );
      setResolved(true);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [active, selectors, padding, stepKey]);

  return { rect, resolved };
}
