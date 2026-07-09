import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { Tooltip } from '@/components/ui/Tooltip';
import { ALLOWED_FILE_EXTENSIONS } from '@/features/document-send/uploadConstants';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import type { UploadContext } from '@/features/upload/types';
import { SidebarTooltip } from '@/components/layout/SidebarTooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';

type NewButtonMenuProps = {
  uploadContext?: UploadContext;
  className?: string;
  collapsed?: boolean;
};

/**
 * Botão "+ Novo" — CTA principal da sidebar (índigo premium) e menu de criação.
 */
export function NewButtonMenu({ uploadContext, className, collapsed = false }: NewButtonMenuProps) {
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
      aria-label={collapsed ? 'Novo' : undefined}
      className={cn(
        'sidebar-new-button',
        collapsed && 'sidebar-new-button--collapsed',
      )}
      data-testid="new-button"
    >
      <Icon name="add" size={ICON_SIZE.md} aria-hidden />
      {!collapsed && (
        <>
          <span className="sidebar-new-button__label">Novo</span>
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
    <div className={cn('relative', className)}>
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

      <SidebarTooltip label="Novo" collapsed={collapsed}>
        {trigger}
      </SidebarTooltip>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement={collapsed ? 'right-start' : 'bottom-start'}
        role="menu"
        aria-label="Criar novo"
        className="sidebar-new-menu w-[15.5rem]"
      >
        <Tooltip label="Pastas manuais chegam em uma próxima fase" wrapperClassName="block w-full">
          <span className="block w-full">
            <button
              type="button"
              role="menuitem"
              className="sidebar-new-menu__item"
              disabled
            >
              <Icon
                name="create_new_folder"
                size={ICON_SIZE.md}
                className="sidebar-new-menu__item-icon--muted"
              />
              Nova pasta
              <span className="sidebar-new-menu__badge">Em breve</span>
            </button>
          </span>
        </Tooltip>
        <button
          type="button"
          role="menuitem"
          className="sidebar-new-menu__item"
          onClick={() => fileInputRef.current?.click()}
          data-testid="new-upload-file"
        >
          <Icon name="upload_file" size={ICON_SIZE.md} className="sidebar-new-menu__item-icon" />
          Upload de arquivo
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
          Upload de pasta
        </button>
        <Link
          to="/solicitar-acesso"
          role="menuitem"
          className="sidebar-new-menu__item"
          onClick={() => setOpen(false)}
          data-testid="new-request-document"
        >
          <Icon name="inbox" size={ICON_SIZE.md} className="sidebar-new-menu__item-icon--muted" />
          Solicitar documento
        </Link>
      </AnchoredPopover>
    </div>
  );
}
