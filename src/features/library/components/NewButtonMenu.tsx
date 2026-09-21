import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { ALLOWED_FILE_EXTENSIONS } from '@/features/document-send/uploadConstants';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import type { UploadContext } from '@/features/upload/types';
import { SidebarTooltip } from '@/components/layout/SidebarTooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useTranslation } from 'react-i18next';

type NewButtonMenuProps = {
  uploadContext?: UploadContext;
  className?: string;
  collapsed?: boolean;
};

/**
 * Botão "+ Novo" — CTA principal da sidebar (índigo premium) e menu de criação.
 */
export function NewButtonMenu({ uploadContext, className, collapsed = false }: NewButtonMenuProps) {
  const { t } = useTranslation('library');

  const { startUploadFromFiles } = useUploadQueueContext();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length > 0) {
      startUploadFromFiles(files, uploadContext);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
    setOpen(false);
  };

  const trigger = (
    <button
      ref={anchorRef}
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={collapsed ? t('newButtonMenu.novo') : undefined}
      className={cn('sidebar-new-button', collapsed && 'sidebar-new-button--collapsed')}
      data-testid="new-button"
    >
      {/* O acento fica só no glifo. O bloco preenchido de largura total era a
          coisa mais alta da tela para uma ação entre muitas, e era o último
          pedaço de outro app sobrando no rail. */}
      <Icon name="add" size={ICON_SIZE.md} className="sidebar-new-button__glyph" aria-hidden />
      {!collapsed && (
        <>
          <span className="sidebar-new-button__label">{t('newButtonMenu.enviarDocumento')}</span>
          <Icon
            name="keyboard_arrow_down"
            size={ICON_SIZE.sm}
            className="sidebar-new-button__chevron"
            aria-hidden
          />
        </>
      )}
    </button>
  );

  return (
    <div className={cn('relative', className)} data-tour="new-button">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_EXTENSIONS.join(',')}
        multiple
        className="hidden"
        onChange={(event) => handleFilesSelected(event.target.files)}
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        onChange={(event) => handleFilesSelected(event.target.files)}
        aria-hidden
        tabIndex={-1}
      />

      <SidebarTooltip label={t('newButtonMenu.novo')} collapsed={collapsed}>
        {trigger}
      </SidebarTooltip>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement={collapsed ? 'right-start' : 'bottom-start'}
        role="menu"
        aria-label={t('newButtonMenu.criarNovo')}
        className="sidebar-new-menu w-[15.5rem]"
      >
        {/* Pasta da Biblioteca é categoria de governança — não há duas coisas.
            O item prometia uma pasta manual que nunca vai existir; agora leva
            para o formulário de categoria, que é onde a "pasta" nasce. */}
        <Link
          to="/rules?nova=categoria"
          role="menuitem"
          className="sidebar-new-menu__item"
          onClick={() => setOpen(false)}
          data-testid="new-category"
        >
          <Icon
            name="create_new_folder"
            size={ICON_SIZE.md}
            className="sidebar-new-menu__item-icon"
          />

          {t('newButtonMenu.novaCategoria')}
        </Link>
        <button
          type="button"
          role="menuitem"
          className="sidebar-new-menu__item"
          onClick={() => fileInputRef.current?.click()}
          data-testid="new-upload-file"
        >
          <Icon name="upload_file" size={ICON_SIZE.md} className="sidebar-new-menu__item-icon" />

          {t('newButtonMenu.uploadDeArquivo')}
        </button>
        <button
          type="button"
          role="menuitem"
          className="sidebar-new-menu__item"
          onClick={() => folderInputRef.current?.click()}
          data-testid="new-upload-folder"
        >
          <Icon
            name="drive_folder_upload"
            size={ICON_SIZE.md}
            className="sidebar-new-menu__item-icon"
          />

          {t('newButtonMenu.uploadDePasta')}
        </button>
        {/* Pedir um documento a alguém é isto, e não tem nada a ver com pedir acesso — os nomes
            se pareciam, e o destino errado não dava erro nenhum: abria o onboarding para quem já
            estava dentro. */}
        <Link
          to="/requests?new=1"
          role="menuitem"
          className="sidebar-new-menu__item"
          onClick={() => setOpen(false)}
          data-testid="new-request-document"
        >
          <Icon name="inbox" size={ICON_SIZE.md} className="sidebar-new-menu__item-icon--muted" />

          {t('newButtonMenu.solicitarDocumento')}
        </Link>
      </AnchoredPopover>
    </div>
  );
}
