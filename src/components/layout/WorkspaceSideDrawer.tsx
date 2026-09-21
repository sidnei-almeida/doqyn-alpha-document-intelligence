import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayLayer, useStableCallback } from '@/components/ui/overlayStack';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export type WorkspaceSideDrawerProps = {
  open?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  ariaLabel?: string;
  testId: string;
  closeTestId?: string;
  closeAriaLabel?: string;
  overlayTestId?: string;
  zIndexClass?: string;
  maxWidthClass?: string;
  scrollable?: boolean;
  onOverlayClick?: () => void;
  header?: ReactNode;
  headerActions?: ReactNode;
  /** Faixa fixa no rodapé — não rola com o corpo. Some quando não há ação. */
  footer?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
};

/**
 * Gaveta lateral do workspace — overlay, cabeçalho, Escape e corpo rolável.
 *
 * O cabeçalho fala a mesma língua das páginas: rótulo de registro em cima,
 * nome em seguida. O respiro é o mesmo do resto do sistema, para que a gaveta
 * não pareça uma tela apertada colada na lateral.
 *
 * A gaveta nasce em `document.body`, como o `Modal`, e não onde o React a
 * declara. No tema `standard` o shell inteiro fica sob `chrome-dark`, que
 * reaplica a paleta grafite; uma gaveta declarada lá dentro herdava o grafite e
 * contradizia o painel de papel ao lado dela. No portal ela pousa sob a paleta
 * padrão do documento, que é a do painel — e nos temas claro e escuro nada
 * muda, porque lá as duas camadas já usam a mesma paleta.
 */
export function WorkspaceSideDrawer({
  open = true,
  onClose,
  title,
  subtitle,
  ariaLabel,
  testId,
  closeTestId,
  closeAriaLabel: closeAriaLabelProp,
  overlayTestId,
  zIndexClass = 'z-[85]',
  maxWidthClass = 'max-w-xl',
  scrollable = true,
  onOverlayClick,
  header,
  headerActions,
  footer,
  bodyClassName,
  children,
}: WorkspaceSideDrawerProps) {
  const { t } = useTranslation('common');
  const closeAriaLabel = closeAriaLabelProp ?? t('actions.close');
  const isTopLayer = useOverlayLayer(open);
  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {
    // Só a camada do topo responde: um modal aberto por cima fecha primeiro.
    if (event.key !== 'Escape' || !isTopLayer()) return;
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleOverlayClick = onOverlayClick ?? onClose;

  return createPortal(
    <div
      className={cn(
        'modal-overlay-scrim fixed inset-0 flex justify-end backdrop-blur-[1px]',
        zIndexClass,
      )}
      role="presentation"
      data-overlay-host
      data-testid={overlayTestId}
      onClick={handleOverlayClick}
    >
      <aside
        className={cn(
          // O fundo é o da página, não uma superfície elevada: a gaveta é um
          // pedaço do mesmo documento, aberto pela lateral.
          // `color` é reancorado aqui de propósito: no portal a gaveta herda o
          // texto do `body`, e cada fronteira de paleta precisa redizer o seu.
          'drawer-enter-right flex h-full w-full flex-col overflow-hidden border-l border-doqyn-border bg-doqyn-bg text-doqyn-text shadow-modal',
          maxWidthClass,
        )}
        aria-label={ariaLabel ?? title}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        {header ?? (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-doqyn-border-subtle px-5 py-4">
            <div className="min-w-0 flex-1">
              <TruncatedText as="h2" className="type-h2 text-doqyn-text">
                {title}
              </TruncatedText>
              {subtitle ? (
                // O invólucro do tooltip é `inline-flex`: sem um bloco em volta,
                // o subtítulo encosta no fim do título em vez de descer uma linha.
                <div className="mt-1">
                  <TruncatedText className="register-label text-doqyn-subtle">
                    {subtitle}
                  </TruncatedText>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {headerActions}
              <IconButton label={closeAriaLabel} onClick={onClose} data-testid={closeTestId}>
                <Icon name="close" size={ICON_SIZE.sm} />
              </IconButton>
            </div>
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 px-5 py-4',
            scrollable && 'scrollbar-thin overflow-y-auto',
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-3">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
