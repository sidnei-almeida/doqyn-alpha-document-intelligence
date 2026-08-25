import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

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
 */
export function WorkspaceSideDrawer({
  open = true,
  onClose,
  title,
  subtitle,
  ariaLabel,
  testId,
  closeTestId,
  closeAriaLabel = 'Fechar',
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
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = onOverlayClick ?? onClose;

  return (
    <div
      className={cn(
        'modal-overlay-scrim fixed inset-0 flex justify-end backdrop-blur-[1px]',
        zIndexClass,
      )}
      role="presentation"
      data-testid={overlayTestId}
      onClick={handleOverlayClick}
    >
      <aside
        className={cn(
          // O fundo é o da página, não uma superfície elevada: a gaveta é um
          // pedaço do mesmo documento, aberto pela lateral.
          'drawer-enter-right flex h-full w-full flex-col overflow-hidden border-l border-doqyn-border bg-doqyn-bg shadow-modal',
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
    </div>
  );
}
