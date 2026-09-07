import { useEffect, useRef } from 'react';

/**
 * Pilha de camadas sobrepostas — modais e gavetas.
 *
 * Cada camada escuta o `keydown` da janela por conta própria, e `stopPropagation`
 * não segura outro ouvinte no mesmo nó. Sem uma pilha comum, um Escape com o
 * modal aberto por cima da gaveta fechava a gaveta de baixo, ou as duas.
 *
 * Quem estiver no topo responde; o resto ignora e continua montado.
 */
const stack: symbol[] = [];

/**
 * Registra a camada enquanto `open`, e devolve um teste de "sou o topo?".
 *
 * O teste é uma função, não um booleano: ele precisa ser lido **no momento da
 * tecla**, não no render em que o ouvinte foi criado.
 */
export function useOverlayLayer(open: boolean): () => boolean {
  const id = useRef(Symbol('overlay')).current;

  useEffect(() => {
    if (!open) return;
    stack.push(id);
    return () => {
      const index = stack.lastIndexOf(id);
      if (index !== -1) stack.splice(index, 1);
    };
  }, [open, id]);

  return useRef(() => stack[stack.length - 1] === id).current;
}

/**
 * Mantém `handler` acessível por uma referência estável.
 *
 * O ouvinte de teclado não pode trocar de identidade a cada render: se o
 * `onClose` vem como arrow inline, o efeito reassina toda vez — e basta outra
 * camada disparar um render no meio do disparo do evento para o ouvinte ser
 * removido antes de ser chamado. O DOM pula ouvinte removido e não chama o
 * recém-adicionado, então a tecla simplesmente some.
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(handler: T): T {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  return useRef(((...args) => ref.current(...args)) as T).current;
}
