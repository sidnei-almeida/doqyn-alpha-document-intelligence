import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useCallback, useState } from 'react';

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClear?: () => void;
  className?: string;
  accept?: string;
}

export function UploadDropzone({
  onFileSelect,
  selectedFile,
  onClear,
  className,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg',
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  if (selectedFile) {
    return (
      <div
        className={cn(
          'flex items-center justify-between rounded-lg border border-doqyn-border bg-doqyn-surface p-4',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-doqyn-primary/10">
            <Icon name="draft" size={ICON_SIZE.md} className="text-doqyn-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-doqyn-text">{selectedFile.name}</p>
            <p className="text-xs text-doqyn-muted">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-card hover:text-doqyn-text"
          >
            <Icon name="close" size={ICON_SIZE.sm} />
          </button>
        )}
      </div>
    );
  }

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors',
        isDragging
          ? 'border-doqyn-primary bg-doqyn-primary/5'
          : 'border-doqyn-border bg-doqyn-surface hover:border-doqyn-muted',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" className="hidden" accept={accept} onChange={handleChange} />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-doqyn-card">
        <Icon name="upload" size={ICON_SIZE.md} className="text-doqyn-muted" />
      </div>
      <p className="mt-4 text-sm font-medium text-doqyn-text">
        Arraste o documento ou clique para selecionar
      </p>
      <p className="mt-1 text-xs text-doqyn-muted">PDF, Word, Excel ou imagens — até 25 MB</p>
    </label>
  );
}
