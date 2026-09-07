import { useEffect, useRef, useState } from 'react';

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

export function UploadScanStack({ items }: { items: UploadQueueItem[] }) {
  /**
   * Acabado o lote, fica a última folha — e não um ícone.
   *
   * O cabeçalho mostrava uma estrelinha de "IA" quando não havia mais nada em curso, e ela era a
   * única coisa decorativa de uma peça feita inteira para mostrar o documento sendo lido. Trocar
   * papel por brilho no fim faz a fila mudar de identidade no meio do próprio trabalho.
   */
  const emCurso = items.filter((item) => isUploadInProgress(item.status));
  const visiveis = (emCurso.length > 0 ? emCurso : items.slice(-1))
    .filter((item) => item.thumbnail)
    .slice(0, VISIBLE);

  /**
   * Quem saiu da frente, ainda em cena.
   *
   * Estado à parte, e **não** uma cópia da lista visível: a folha da vez é sempre derivada de
   * `items` no render, então ela volta sozinha se voltar a valer — foi o que quebrou quando a
   * pilha guardava as duas coisas no mesmo lugar e o fim do lote não trazia ninguém de volta.
   */
  const [saindo, setSaindo] = useState<UploadQueueItem[]>([]);
  const anterior = useRef<UploadQueueItem[]>([]);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const agora = new Set(visiveis.map((item) => item.id));
    const partiram = anterior.current.filter((item) => !agora.has(item.id));
    anterior.current = visiveis;

    if (partiram.length === 0) return;

    setSaindo((current) => [
      ...current.filter((item) => !partiram.some((outro) => outro.id === item.id)),
      ...partiram,
    ]);

    for (const item of partiram) {
      window.clearTimeout(timers.current.get(item.id));
      const timer = window.setTimeout(() => {
        timers.current.delete(item.id);
        setSaindo((current) => current.filter((outro) => outro.id !== item.id));
      }, LEAVE_MS);
      timers.current.set(item.id, timer);
    }
    // Comparar a lista derivada a cada render é o ponto: é assim que a saída acompanha o evento
    // real, e não um intervalo.
  }, [visiveis]);

  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of running.values()) window.clearTimeout(timer);
      running.clear();
    };
  }, []);

  // Quem voltou a valer não está saindo: a lista derivada manda.
  const emCena = saindo.filter((item) => !visiveis.some((outro) => outro.id === item.id));
  if (visiveis.length === 0 && emCena.length === 0) return null;

  /**
   * As de trás recuam, giram e escurecem.
   *
   * O giro não é enfeite: em miniatura de 32px, só deslocar não lê como pilha — as bordas ficam
   * paralelas e o olho vê uma folha com sombra. Um grau e meio por folha basta para virar papel
   * empilhado, e é pouco o bastante para não parecer torto.
   */
  return (
    <span className="relative block h-11 w-11 shrink-0" aria-hidden>
      {emCena.map((item) => (
        <span
          key={item.id}
          className="upload-stack__sheet upload-stack__sheet--leaving absolute inset-y-0 left-0 w-8 overflow-hidden rounded-[2px] bg-white"
          style={{ zIndex: VISIBLE + 1 }}
        >
          <img
            src={item.thumbnail!.url}
            alt=""
            className="h-full w-full object-cover object-top"
            draggable={false}
          />
        </span>
      ))}

      {visiveis.map((item, atras) => (
        <span
          key={item.id}
          className="upload-stack__sheet absolute inset-y-0 left-0 w-8 overflow-hidden rounded-[2px] bg-white"
          style={{
            transform: `translateX(${atras * 5}px) translateY(${atras * -3}px) rotate(${atras * 1.5}deg) scale(${1 - atras * 0.06})`,
            opacity: 1 - atras * 0.3,
            zIndex: VISIBLE - atras,
          }}
        >
          <img
            src={item.thumbnail!.url}
            alt=""
            className="h-full w-full object-cover object-top"
            draggable={false}
          />
          {/* Só a da frente é varrida: é a única que a IA está lendo agora. */}
          {atras === 0 && item.status === 'analyzing' ? (
            <span className="upload-thumb__scan pointer-events-none absolute inset-x-0" />
          ) : null}
        </span>
      ))}
    </span>
  );
}
