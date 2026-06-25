import { useCallback, useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE_MB, MAX_FILES_PER_BATCH } from '../uploadConstants';
import { validateBulkFiles } from '../utils/validateBulkUpload';

interface UploadCardProps {
  onFilesSelected: (files: File[], invalidItems: Array<{ file: File; error: string }>) => void;
  onValidationError: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function UploadCard({
  onFilesSelected,
  onValidationError,
  disabled = false,
  className,
}: UploadCardProps) {
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
    <Card
      className={cn(
        'flow-enter flex min-h-0 flex-1 flex-col border-doqyn-border bg-doqyn-surface',
        'max-md:min-h-[40vh] max-md:flex-none',
        className,
      )}
    >
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
          'flex min-h-[300px] flex-1 cursor-pointer flex-col items-center justify-center',
          'rounded-lg border-2 border-dashed m-3 px-4 py-6 transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-surface',
          disabled && 'cursor-not-allowed opacity-60',
          isDragging
            ? 'border-doqyn-primary border-solid bg-doqyn-primary-bg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
            : 'border-doqyn-primary/40 bg-doqyn-bg/40 hover:border-doqyn-primary/70 hover:bg-doqyn-action/[0.05]',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept=".pdf,application/pdf"
          multiple
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-doqyn-surface-soft">
          <Upload className="h-5 w-5 text-doqyn-primary" />
        </div>
        <p id={`${inputId}-title`} className="mt-4 text-sm font-medium text-doqyn-text">
          Envie um documento
        </p>
        <p className="mt-1 text-sm text-doqyn-muted">
          Arraste um ou mais PDFs aqui ou clique para selecionar
        </p>
        <p className="mt-3 text-xs text-doqyn-muted">
          PDF textual, até {MAX_FILE_SIZE_MB} MB · máx. {MAX_FILES_PER_BATCH} por lote
        </p>
      </div>
    </Card>
  );
}
