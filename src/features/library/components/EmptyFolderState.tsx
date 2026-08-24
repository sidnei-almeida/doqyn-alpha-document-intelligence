import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ICON_SIZE } from '@/lib/iconDefaults';

type EmptyFolderStateProps = {
  hasActiveFilters: boolean;
  title?: string;
  description?: string;
  showUploadActions?: boolean;
  onClearFilters: () => void;
  onUploadClick: () => void;
  uploadButtonLabel?: string;
};

/**
 * Empty state dentro de pasta — minimalista, flat, com ação de upload.
 */
export function EmptyFolderState({
  hasActiveFilters,
  title = 'Esta pasta ainda está vazia',
  description = 'Envie um documento para o DOQYN analisar e classificar.',
  showUploadActions = true,
  onClearFilters,
  onUploadClick,
  uploadButtonLabel = 'Enviar documento',
}: EmptyFolderStateProps) {
  if (hasActiveFilters) {
    return (
      <div
        className="flex min-h-[min(360px,50vh)] flex-col items-center justify-center px-6 py-16 text-center"
        data-testid="library-empty-state"
      >
        <p className="text-label font-medium text-doqyn-text">
          Nenhum documento para os filtros atuais
        </p>
        <p className="mt-1.5 max-w-[42ch] text-caption leading-relaxed text-doqyn-muted">
          Ajuste a busca ou os filtros para ampliar os resultados.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onClearFilters}
        >
          Limpar filtros
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[min(400px,55vh)] flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="library-empty-state"
    >
      <span className="mb-4 flex items-center justify-center text-doqyn-border-strong">
        {showUploadActions ? (
          <Icon name="cloud_upload" size={ICON_SIZE.md} />
        ) : (
          <Icon name="folder_open" size={ICON_SIZE.md} />
        )}
      </span>
      <p className="text-label font-medium text-doqyn-text">{title}</p>
      <p className="mt-1.5 max-w-[42ch] text-caption leading-relaxed text-doqyn-muted">
        {description}
      </p>
      {showUploadActions && (
        <>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="mt-6"
            onClick={onUploadClick}
          >
            {uploadButtonLabel}
          </Button>
          <p className="mt-4 text-[12px] text-doqyn-subtle">
            Você também pode arrastar arquivos para esta janela.
          </p>
        </>
      )}
    </div>
  );
}
