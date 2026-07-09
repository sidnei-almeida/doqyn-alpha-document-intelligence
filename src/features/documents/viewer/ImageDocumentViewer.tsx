import { Icon } from '@/components/ui/Icon';

type ImageDocumentViewerProps = {
  className?: string;
};

/** Placeholder para previews de imagem (JPG/PNG/WebP) — Fase 2. */
export function ImageDocumentViewer({ className }: ImageDocumentViewerProps) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${className ?? ''}`}
    >
      <Icon name="image" size={40} className="text-doqyn-muted" aria-hidden />
      <p className="text-sm text-doqyn-muted">
        Visualizador de imagens em desenvolvimento. Em breve: zoom, fit e pan.
      </p>
    </div>
  );
}
