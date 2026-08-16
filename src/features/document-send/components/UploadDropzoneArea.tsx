import { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE_MB, MAX_FILES_PER_BATCH, UPLOAD_ACCEPT } from '../uploadConstants';
import { validateBulkFiles } from '../utils/validateBulkUpload';

interface UploadDropzoneAreaProps {
  onFilesSelected: (files: File[], invalidItems: Array<{ file: File; error: string }>) => void;
  onValidationError: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function UploadDropzoneArea({
  onFilesSelected,
  onValidationError,
  disabled = false,
  className,
}: UploadDropzoneAreaProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const fileArray = Array.from(incoming);
      const result = validateBulkFiles(fileArray);

      if (result.batchError) {
        onValidationError(result.batchError);
        return;
      }

      if (result.validFiles.length === 0 && result.invalidItems.length === 0) {
        return;
      }

      onFilesSelected(result.validFiles, result.invalidItems);
    },
    [onFilesSelected, onValidationError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles],
  );

  const openFilePicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFilePicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-labelledby={`${inputId}-title`}
      onKeyDown={handleKeyDown}
      onClick={openFilePicker}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex w-full max-w-xl cursor-pointer flex-col items-center justify-center',
        'max-h-[220px] min-h-[168px] rounded-lg border border-dashed px-6 py-8',
        'transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-surface',
        disabled && 'cursor-not-allowed opacity-60',
        isDragging
          ? 'bg-doqyn-accent-active-bg/40 border-doqyn-accent-active'
          : 'border-doqyn-border-strong/55 bg-doqyn-bg/35 hover:border-doqyn-accent-active/45 hover:bg-doqyn-surface-hover',
        className,
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={UPLOAD_ACCEPT}
        multiple
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-doqyn-border-subtle bg-doqyn-card">
        <Icon name="upload" size={ICON_SIZE.nav} className="text-doqyn-primary" />
      </div>
      <p id={`${inputId}-title`} className="mt-4 text-sm font-medium text-doqyn-text">
        Comece enviando um documento
      </p>
      <p className="mt-1 max-w-sm text-center text-sm text-doqyn-muted">
        Arraste PDFs ou imagens (JPG, PNG, WebP) aqui ou clique para selecionar
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Badge variant="neutral" dot={false} className="text-micro">
          PDF · JPG · PNG · WebP
        </Badge>
        <Badge variant="neutral" dot={false} className="text-micro">
          até {MAX_FILE_SIZE_MB} MB
        </Badge>
        <Badge variant="neutral" dot={false} className="text-micro">
          máx. {MAX_FILES_PER_BATCH} por lote
        </Badge>
      </div>
    </div>
  );
}
