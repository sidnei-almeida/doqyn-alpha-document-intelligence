import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { MAX_FILE_SIZE_MB, MAX_FILES_PER_BATCH } from '../uploadConstants';
import { formatFileSize, validateUploadFiles } from '../utils/validateUpload';

export interface UploadCardHandle {
  reset: () => void;
  isDirty: () => boolean;
  getFiles: () => File[];
}

interface UploadCardProps {
  isProcessing: boolean;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onValidationError: (message: string) => void;
  onSubmit: () => void;
}

export const UploadCard = forwardRef<UploadCardHandle, UploadCardProps>(function UploadCard(
  { isProcessing, selectedFiles, onFilesChange, onValidationError, onSubmit },
  ref,
) {
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    onFilesChange([]);
  }, [onFilesChange]);

  useImperativeHandle(ref, () => ({
    reset,
    isDirty: () => selectedFiles.length > 0,
    getFiles: () => selectedFiles,
  }));

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const fileArray = Array.from(incoming);
      const result = validateUploadFiles(fileArray, selectedFiles.length);

      if (!result.valid) {
        onValidationError(result.error);
        return;
      }

      const merged = [...selectedFiles];
      result.files.forEach((file) => {
        if (!merged.some((f) => f.name === file.name && f.size === file.size)) {
          merged.push(file);
        }
      });

      onFilesChange(merged);
    },
    [onFilesChange, onValidationError, selectedFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const removeFile = (index: number) => {
    onFilesChange(selectedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      onValidationError('Selecione ao menos um arquivo para enviar.');
      return;
    }
    onSubmit();
  };

  return (
    <Card className="flex h-full min-h-0 flex-col border-doqyn-border bg-doqyn-surface">
      <CardHeader className="shrink-0">
        <CardTitle>Enviar documento</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-1 flex-col gap-4">
          <label
            className={cn(
              'flex w-full min-h-[120px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors',
              isDragging
                ? 'border-doqyn-primary bg-doqyn-primary-bg'
                : 'border-doqyn-primary/40 bg-doqyn-bg/40 hover:border-doqyn-primary/60 hover:bg-doqyn-action/[0.03]',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,application/pdf,image/png,image/jpeg,image/tiff"
              onChange={(e) => {
                if (e.target.files?.length) {
                  addFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-doqyn-surface-soft">
              <Upload className="h-5 w-5 text-doqyn-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-doqyn-text">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="mt-1 max-w-sm text-center text-xs text-doqyn-muted">
              Envio individual ou em lote. Os nomes serão gerados automaticamente após a análise.
            </p>
            <p className="mt-3 text-xs text-doqyn-muted">
              PDF, PNG, JPEG, TIFF — até {MAX_FILE_SIZE_MB}MB · máx. {MAX_FILES_PER_BATCH} arquivos
            </p>
          </label>

          {selectedFiles.length > 0 && (
            <ul className="max-h-32 shrink-0 space-y-2 overflow-y-auto scrollbar-thin">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between rounded-lg border border-doqyn-border bg-doqyn-bg/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-doqyn-text">{file.name}</p>
                    <p className="text-xs text-doqyn-muted">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={isProcessing}
                    className="shrink-0 rounded p-1 text-doqyn-muted hover:text-doqyn-text disabled:opacity-40"
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="shrink-0 space-y-3">
            <p className="text-xs text-doqyn-muted">
              O nome será gerado automaticamente após a análise do documento.
            </p>
            <Input
              id="document-suggested-name"
              label="Nome sugerido"
              placeholder="Gerado automaticamente após a análise"
              value=""
              readOnly
              disabled
              tabIndex={-1}
              aria-readonly="true"
            />
          </div>

          <Button
            type="submit"
            disabled={isProcessing || selectedFiles.length === 0}
            className="w-full shrink-0 bg-doqyn-action hover:bg-doqyn-action-hover"
          >
            {isProcessing
              ? 'Processando...'
              : selectedFiles.length > 1
                ? `Enviar ${selectedFiles.length} arquivos para análise`
                : 'Enviar para análise'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
});
