import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { useOverlayLayer, useStableCallback } from '@/components/ui/overlayStack';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg';

/**
 * Altura na pilha. `modal` é o normal; `confirm` é para o diálogo que nasce de
 * dentro de outro — confirmar uma exclusão pedida por um modal já aberto.
 */
export type ModalLayer = 'modal' | 'confirm';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Linha fina sob o título — nome do documento, categoria, versão. */
  subtitle?: ReactNode;
  size?: ModalSize;
  /** Faixa fixa no rodapé; some quando não há ação. */
  footer?: ReactNode;
  /** Trilha de passos, régua ou abas — encosta no fio do cabeçalho. */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Fechar clicando fora. Desligue em fluxo com dado digitado. */
  dismissOnOverlay?: boolean;
  /** `confirm` sobe o diálogo acima de outro modal já aberto. */
  layer?: ModalLayer;
};

/**
 * Diálogo em portal no `body`.
 *
 * Todo modal do app era montado à mão dentro da árvore de quem o abria, e herdava
 * `overflow` e contexto de empilhamento do pai — daí os popups cortados dentro deles.
 * Aqui o diálogo sai da árvore, o corpo trava o scroll enquanto está aberto e o foco
 * fica preso no diálogo até fechar.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  toolbar,
  children,
  className,
  dismissOnOverlay = true,
  layer = 'modal',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isTopLayer = useOverlayLayer(open);
  const onCloseStable = useStableCallback(onClose);

  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {
    // Só a camada do topo responde: a de baixo continua montada e escutando.
    if (!isTopLayer()) return;

    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseStable();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;

    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const restoreFocusTo = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      // Campo antes de botão: abrir com o foco no "fechar" faz o diálogo nascer
      // parecendo prestes a ser fechado, e o anel de foco rouba a leitura do título.
      // O "fechar" do cabeçalho fica fora da disputa: sem campo, o foco cai no
      // primeiro controle do corpo ou do rodapé, e só então no próprio painel.
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) ??
        Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).find(
          (el) => !el.hasAttribute('data-modal-close'),
        ) ??
        panel;
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previous;
      restoreFocusTo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        'modal-overlay modal-overlay-scrim',
        layer === 'confirm' && 'modal-overlay--confirm',
      )}
      onMouseDown={(event) => {
        if (dismissOnOverlay && event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('modal-panel', SIZE_CLASS[size], className)}
      >
        <header className="modal-panel__header">
          <div className="min-w-0">
            <h2 id={titleId} className="modal-panel__title">
              {title}
            </h2>
            {subtitle ? <div className="modal-panel__subtitle">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-panel__close"
            data-modal-close
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.sm} aria-hidden />
          </button>
        </header>

        {toolbar ? <div className="modal-panel__toolbar">{toolbar}</div> : null}

        <div className="modal-panel__body">{children}</div>

        {footer ? <footer className="modal-panel__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
