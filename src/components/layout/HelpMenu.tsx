import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { dropdownMenuItemClass } from '@/components/ui/dropdownMenuStyles';
import { useTour } from '@/features/tour/useTour';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

/**
 * O "?" da barra.
 *
 * Era um link direto para doqyn.com. Virou menu porque passou a ter duas
 * respostas para a mesma pergunta: o tour, que explica esta tela, e o site,
 * que explica o produto. Mandar quem quer a primeira para a segunda é o tipo
 * de ajuda que ninguém volta a procurar.
 */
export function HelpMenu({ className }: { className?: string }) {
  const { t } = useTranslation('components');

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { start } = useTour();

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        data-tour="help"
        onClick={() => setOpen((value) => !value)}
        className={cn(className, open && 'text-doqyn-text')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('helpMenu.ajuda')}
      >
        <Icon name="help" size={ICON_SIZE.nav} />
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        role="menu"
        aria-label={t('helpMenu.ajuda2')}
        className="w-60 max-w-[calc(100vw-1rem)] py-1"
      >
        <button
          type="button"
          role="menuitem"
          className={cn(dropdownMenuItemClass, 'gap-2.5 hover:before:bg-doqyn-accent-active')}
          onClick={() => {
            setOpen(false);
            start();
          }}
        >
          <Icon name="explore" size={ICON_SIZE.md} />
          <span className="min-w-0 text-left">
            <span className="block">{t('helpMenu.verOTour')}</span>
            <span className="mt-0.5 block text-micro text-doqyn-muted">
              {t('helpMenu.ondeFicaCadaCoisa')}
            </span>
          </span>
        </button>

        <div className="my-1 border-t border-doqyn-border-subtle" />

        <a
          href="https://doqyn.com"
          target="_blank"
          rel="noreferrer"
          role="menuitem"
          className={cn(
            dropdownMenuItemClass,
            'gap-2.5 text-doqyn-muted hover:text-doqyn-text hover:before:bg-doqyn-accent-active',
          )}
          onClick={() => setOpen(false)}
        >
          <Icon name="open_in_new" size={ICON_SIZE.md} />

          {t('helpMenu.centralDeAjuda')}
        </a>
      </AnchoredPopover>
    </div>
  );
}
