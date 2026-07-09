import { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE_MB } from '@/features/document-send/uploadConstants';
import { formatFileSize, isAllowedPdfFile } from '@/features/document-send/utils/validateUpload';

type NewVersionUploadDropzoneProps = {
  nextVersionLabel: string;
  disabled?: boolean;
  selectedFile?: File | null;
  onFileSelected: (file: File) => void;
  onClearFile?: () => void;
  onValidationError: (message: string) => void;
  fillHeight?: boolean;
};

export function NewVersionUploadDropzone({
  nextVersionLabel,
  disabled = false,
  selectedFile,
  onFileSelected,
  onClearFile,
  onValidationError,
  fillHeight = false,
}: NewVersionUploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!isAllowedPdfFile(file)) {
        onValidationError('Envie um arquivo PDF para criar uma nova versão.');
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected, onValidationError],
  );

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-doqyn-border-subtle bg-doqyn-surface/50 p-3',
        fillHeight && 'min-h-0 flex-1',
      )}
      data-testid="update-version-upload-dropzone"
    >
      <div className="mb-3 shrink-0">
        <p className="text-[12px] font-semibold text-doqyn-text">Enviar nova versão</p>
        <p className="mt-0.5 text-[11px] text-doqyn-muted">
          Histórico preservado · será criada{' '}
          <span className="font-medium text-doqyn-text">{nextVersionLabel}</span>
        </p>
      </div>

      {selectedFile ? (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/50 px-4 py-3',
            fillHeight && 'min-h-0 flex-1',
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-doqyn-text">{selectedFile.name}</p>
            <p className="mt-0.5 text-[12px] text-doqyn-muted">{formatFileSize(selectedFile.size)}</p>
            <p className="mt-1 text-[11px] text-doqyn-muted">
              Pronto para análise · será registrado como {nextVersionLabel}
            </p>
          </div>
          {onClearFile && (
            <button
              type="button"
              className="explorer-icon-btn shrink-0"
              onClick={onClearFile}
              aria-label="Remover arquivo selecionado"
            >
              <Icon name="close" size={ICON_SIZE.sm} />
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-labelledby={`${inputId}-title`}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (disabled) return;
            const file = event.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={cn(
            'flex w-full cursor-pointer flex-col items-center justify-center',
            'rounded-lg border border-dashed px-5 py-6 text-center',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-surface',
            fillHeight ? 'min-h-[180px] flex-1' : 'min-h-[140px]',
            disabled && 'cursor-not-allowed opacity-60',
            isDragging
              ? 'border-doqyn-accent-active bg-doqyn-accent-active-bg/40'
              : 'border-doqyn-border-strong/55 bg-doqyn-bg/35 hover:border-doqyn-accent-active/45 hover:bg-doqyn-surface-hover',
          )}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-doqyn-border-subtle bg-doqyn-card">
            <Icon name="upload" size={ICON_SIZE.nav} className="text-doqyn-primary" />
          </div>
          <p id={`${inputId}-title`} className="mt-4 text-sm font-medium text-doqyn-text">
            Arraste o PDF ou clique para selecionar
          </p>
          <p className="mt-1 max-w-sm text-sm text-doqyn-muted">
            O documento original será preservado no histórico
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="neutral" dot={false} className="text-[11px]">
              PDF
            </Badge>
            <Badge variant="neutral" dot={false} className="text-[11px]">
              até {MAX_FILE_SIZE_MB} MB
            </Badge>
            <Badge variant="neutral" dot={false} className="text-[11px]">
              {nextVersionLabel}
            </Badge>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept=".pdf,application/pdf"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = '';
        }}
      />
    </section>
  );
}
