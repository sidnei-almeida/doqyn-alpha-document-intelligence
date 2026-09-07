import { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { fileDropzoneProps } from '@/features/upload/drag-drop/useGlobalDragDrop';
import { MAX_FILE_SIZE_MB, UPLOAD_ACCEPT } from '@/features/document-send/uploadConstants';
import {
  formatFileSize,
  isAllowedAnalysisFile,
} from '@/features/document-send/utils/validateUpload';

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
      if (!isAllowedAnalysisFile(file)) {
        onValidationError('Envie PDF ou imagem (JPG, PNG ou WebP) para criar uma nova versão.');
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
        'flex flex-col border-t border-doqyn-border-subtle pt-3',
        fillHeight && 'min-h-0 flex-1',
      )}
      data-testid="update-version-upload-dropzone"
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <p className="register-label text-doqyn-subtle">Enviar nova versão</p>
        <span className="font-mono text-micro tabular-nums text-doqyn-subtle">
          {nextVersionLabel}
        </span>
      </div>

      {selectedFile ? (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-[4px] border border-doqyn-border-subtle px-4 py-3',
            fillHeight && 'min-h-0 flex-1',
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-label font-medium text-doqyn-text">{selectedFile.name}</p>
            <p className="mt-1 font-mono text-micro tabular-nums text-doqyn-subtle">
              {formatFileSize(selectedFile.size)} · pronto para análise
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
          {...fileDropzoneProps}
          className={cn(
            'flex w-full cursor-pointer flex-col items-center justify-center',
            'rounded-[4px] border border-dashed px-5 py-6 text-center',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-surface',
            fillHeight ? 'min-h-[180px] flex-1' : 'min-h-[140px]',
            disabled && 'cursor-not-allowed opacity-60',
            isDragging
              ? 'border-doqyn-accent-active bg-doqyn-accent-active-bg/40'
              : 'border-doqyn-border-strong/55 bg-doqyn-bg/35 hover:border-doqyn-accent-active/45 hover:bg-doqyn-surface-hover',
          )}
        >
          {/* O disco com glifo era a única forma redonda da gaveta, e três
              etiquetas repetiam o que uma linha de registro diz melhor. A
              promessa de preservar o histórico já é dita no rodapé — não
              precisa ser repetida aqui e no rótulo do bloco. */}
          <Icon name="upload" size={ICON_SIZE.nav} className="text-doqyn-border-strong" />
          <p id={`${inputId}-title`} className="mt-3 text-label font-medium text-doqyn-text">
            Arraste PDF ou imagem, ou clique para selecionar
          </p>
          <p className="register-label mt-2 text-doqyn-subtle">
            PDF · JPG · PNG · WEBP · até {MAX_FILE_SIZE_MB} MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={UPLOAD_ACCEPT}
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
