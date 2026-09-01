import { useCallback, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';

type SidebarEdgeToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * O vão entre a barra e o painel é o próprio controle.
 *
 * Antes havia um chevron flutuando ao lado da marca: um botão permanente,
 * visível o tempo todo, para uma ação que a pessoa usa uma vez por semana. Ele
 * ocupava o lugar mais nobre da tela e competia com a marca.
 *
 * O passo seguinte foi um fio que assumia o acento no hover. Isso funcionava
 * enquanto barra e conteúdo se tocavam: o fio *era* a divisão, e acender a
 * divisão dizia o que ela fazia. Com o painel recuado, virou um traço aceso no
 * escuro — cor, e não instrução.
 *
 * Agora a pista é um chevron sozinho, sem caixa: ele acende no ponto exato em
 * que o mouse encosta na borda e some quando o mouse sai. Nascer no meio da
 * altura era o que fazia a pista parecer um botão plantado ali; nascer sob o
 * cursor faz dela uma resposta à mão. O cursor vira mão: isto se clica uma vez,
 * não se arrasta — `col-resize` prometia um arraste que não existe.
 *
 * Sem tooltip: a faixa de clique cobre a altura inteira da barra, e o balão
 * ancora no começo da referência — ele saía lá no alto da janela, longe da mão.
 * O atalho `Ctrl/Cmd + \` continua fazendo o mesmo sem depender de mira, e vai
 * no rótulo acessível do botão.
 */
export function SidebarEdgeToggle({ collapsed, onToggle }: SidebarEdgeToggleProps) {
  const edgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        onToggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggle]);

  /* A posição vertical vive numa custom property, não no estado do React: o
     ponteiro dispara isso a cada pixel, e re-renderizar a barra inteira a essa
     frequência é caro para um efeito que só o CSS precisa saber. */
  const followPointer = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const edge = edgeRef.current;
    if (!edge) return;
    const y = event.clientY - edge.getBoundingClientRect().top;
    edge.style.setProperty('--sidebar-edge-grip-y', `${Math.round(y)}px`);
  }, []);

  /* Ao sair, o ponto volta ao centro — quem chega pelo teclado encontra a pista
     no meio da borda, não no último lugar em que alguém passou o mouse. */
  const resetPointer = useCallback(() => {
    edgeRef.current?.style.removeProperty('--sidebar-edge-grip-y');
  }, []);

  return (
    <button
      ref={edgeRef}
      type="button"
      onClick={onToggle}
      onPointerMove={followPointer}
      onPointerLeave={resetPointer}
      aria-label={`${collapsed ? 'Expandir' : 'Recolher'} barra lateral (Ctrl + \\)`}
      data-testid="sidebar-collapse-toggle"
      className="sidebar-edge-toggle group absolute inset-y-0 right-0 z-10 w-2.5 translate-x-1/2 cursor-pointer focus-visible:outline-none"
    >
      <span aria-hidden className="sidebar-edge-toggle-grip">
        <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={ICON_SIZE.xs} weight={300} />
      </span>
    </button>
  );
}
