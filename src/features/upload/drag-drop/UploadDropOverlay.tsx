import { Icon } from '@/components/ui/Icon';

type UploadDropOverlayProps = {
  isDragging: boolean;
};

/** Overlay fullscreen exibido apenas enquanto o usuário arrasta arquivos sobre a janela. */
export function UploadDropOverlay({ isDragging }: UploadDropOverlayProps) {
  if (!isDragging) return null;

  return (
    <div
      className="bg-doqyn-bg/80 pointer-events-none fixed inset-0 z-[90] flex items-center justify-center backdrop-blur-sm"
      role="presentation"
      data-testid="upload-drop-overlay"
    >
      <div className="overlay-scale-in flex flex-col items-center gap-4 rounded-2xl border border-doqyn-border-subtle bg-doqyn-surface px-12 py-10 text-center shadow-dropdown">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-doqyn-accent-active text-doqyn-on-accent">
          <Icon name="cloud_upload" size={28} />
        </span>
        <div>
          <p className="text-h2 font-medium tracking-tight text-doqyn-text">
            Solte para enviar ao DOQYN
          </p>
          <p className="mt-2 max-w-sm text-label font-normal leading-relaxed text-doqyn-muted">
            A IA analisará, classificará e preparará o documento para revisão antes de salvá-lo na
            Biblioteca.
          </p>
        </div>
      </div>
    </div>
  );
}
