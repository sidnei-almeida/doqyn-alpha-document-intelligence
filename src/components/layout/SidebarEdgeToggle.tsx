import { useEffect } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';

type SidebarEdgeToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * O divisor entre a barra e o conteúdo é o próprio controle.
 *
 * Antes havia um chevron flutuando ao lado da marca: um botão permanente,
 * visível o tempo todo, para uma ação que a pessoa usa uma vez por semana. Ele
 * ocupava o lugar mais nobre da tela e competia com a marca.
 *
 * Aqui a área de clique tem 10px e é invisível até a pessoa chegar perto; no
 * hover o fio do divisor assume o acento, avisando que aquilo responde. É a
 * mesma gramática do resto do sistema — a régua reage — e o alvo continua
 * grande o bastante para o mouse.
 *
 * O atalho `Ctrl/Cmd + \` faz o mesmo sem depender de mira, e é o caminho de
 * quem usa o app todo dia.
 */
export function SidebarEdgeToggle({ collapsed, onToggle }: SidebarEdgeToggleProps) {
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

  return (
    <Tooltip
      label={`${collapsed ? 'Expandir' : 'Recolher'} barra lateral · Ctrl \\`}
      placement="right"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        data-testid="sidebar-collapse-toggle"
        className="group absolute inset-y-0 right-0 z-10 w-2.5 translate-x-1/2 cursor-col-resize focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors duration-150 group-hover:bg-doqyn-accent-active group-focus-visible:bg-doqyn-accent-active"
        />
      </button>
    </Tooltip>
  );
}
