import { ImageIcon } from 'lucide-react';

type ImageDocumentViewerProps = {
  className?: string;
};

/** Placeholder para previews de imagem (JPG/PNG/WebP) — Fase 2. */
export function ImageDocumentViewer({ className }: ImageDocumentViewerProps) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${className ?? ''}`}
    >
      <ImageIcon className="h-10 w-10 text-doqyn-muted" aria-hidden />
      <p className="text-sm text-doqyn-muted">
        Visualizador de imagens em desenvolvimento. Em breve: zoom, fit e pan.
      </p>
    </div>
  );
}
