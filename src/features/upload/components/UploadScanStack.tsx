import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { UploadQueueItem } from '../types';
import { isUploadInProgress } from '../utils/uploadStatusProgress';

/**
 * O lote como pilha de papel: o que está sendo lido na frente, os próximos atrás.
 *
 * **O movimento é por evento, nunca por relógio.** Uma folha só sai quando aquele arquivo termina
 * de verdade, e a de trás avança na mesma hora. Um carrossel temporizado com trinta arquivos vira
 * letreiro — e letreiro no canto da tela, durante um trabalho que dura minutos, é exatamente o
 * tipo de movimento que o resto do app evita.
 *
 * Três folhas visíveis, não a fila inteira: a pilha diz "tem mais vindo", e essa é toda a
 * informação que ela precisa dar. A contagem exata já está escrita ao lado, em texto.
 */
const VISIBLE = 3;

/** Quanto a folha que terminou continua no DOM para poder sair deslizando. */
const LEAVE_MS = 460;

type Slot = { item: UploadQueueItem; leaving: boolean };

export function UploadScanStack({ items }: { items: UploadQueueItem[] }) {
  /**
   * Acabado o lote, fica a última folha — e não um ícone.
   *
   * O cabeçalho mostrava uma estrelinha de "IA" quando não havia mais nada em curso, e ela era a
   * única coisa decorativa de uma peça feita inteira para mostrar o documento de verdade sendo
   * lido. Trocar papel por brilho no fim faz a fila mudar de identidade no meio do próprio
   * trabalho. Enquanto a fila existir, o que se vê é papel.
   */
  const emCurso = items.filter((item) => isUploadInProgress(item.status));
  const active = (emCurso.length > 0 ? emCurso : items.slice(-1)).slice(0, VISIBLE);
  const [slots, setSlots] = useState<Slot[]>(() =>
    active.map((item) => ({ item, leaving: false })),
  );
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    setSlots((current) => {
      const ativos = new Map(active.map((item) => [item.id, item]));

      // Quem saiu da frente fica mais um instante, marcado, para a saída ter o que animar.
      const mantidos = current.map((slot) =>
        ativos.has(slot.item.id)
          ? { item: ativos.get(slot.item.id)!, leaving: false }
          : { ...slot, leaving: true },
      );

      const conhecidos = new Set(mantidos.map((slot) => slot.item.id));
      const novos = active
        .filter((item) => !conhecidos.has(item.id))
        .map((item) => ({ item, leaving: false }));

      return [...mantidos, ...novos];
    });
    // `active` é derivado de `items` a cada render; observar `items` evita o laço infinito que
    // observar o array recriado provocaria.
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // A folha marcada some depois da animação, e não junto com ela.
  useEffect(() => {
    for (const slot of slots) {
      if (!slot.leaving || timers.current.has(slot.item.id)) continue;
      const id = window.setTimeout(() => {
        timers.current.delete(slot.item.id);
        setSlots((current) => current.filter((other) => other.item.id !== slot.item.id));
      }, LEAVE_MS);
      timers.current.set(slot.item.id, id);
    }
  }, [slots]);

  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const id of running.values()) window.clearTimeout(id);
      running.clear();
    };
  }, []);

  const desenhaveis = slots.filter((slot) => slot.item.thumbnail);
  if (desenhaveis.length === 0) return null;

  /**
   * As de trás recuam, giram e escurecem.
   *
   * O giro não é enfeite: em miniatura de 32px, só deslocar não lê como pilha — as bordas ficam
   * paralelas e o olho vê uma folha com sombra. Um grau e meio por folha basta para virar papel
   * empilhado, e é pouco o bastante para não parecer torto.
   */
  let depth = -1;
  return (
    <span className="relative block h-11 w-11 shrink-0" aria-hidden>
      {desenhaveis.map((slot) => {
        if (!slot.leaving) depth += 1;
        const atras = slot.leaving ? 0 : depth;
        return (
          <span
            key={slot.item.id}
            className={cn(
              'upload-stack__sheet absolute inset-y-0 left-0 w-8 overflow-hidden rounded-[2px] bg-white',
              slot.leaving && 'upload-stack__sheet--leaving',
            )}
            style={{
              transform: `translateX(${atras * 5}px) translateY(${atras * -3}px) rotate(${atras * 1.5}deg) scale(${1 - atras * 0.06})`,
              opacity: 1 - atras * 0.3,
              zIndex: VISIBLE - atras,
            }}
          >
            <img
              src={slot.item.thumbnail!.url}
              alt=""
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
            {/* Só a da frente é varrida: é a única que a IA está lendo agora. */}
            {atras === 0 && !slot.leaving && slot.item.status === 'analyzing' ? (
              <span className="upload-thumb__scan pointer-events-none absolute inset-x-0" />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
