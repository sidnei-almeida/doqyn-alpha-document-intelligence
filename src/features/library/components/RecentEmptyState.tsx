import { Button } from '@/components/ui/Button';

type RecentEmptyStateProps = {
  onUploadClick: () => void;
};

/** Empty state discreto para a seção Recentes na home. */
export function RecentEmptyState({ onUploadClick }: RecentEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl bg-doqyn-surface/60 px-6 py-10 text-center"
      data-testid="recent-empty-state"
    >
      <p className="text-[13px] font-medium text-doqyn-text">Nenhum arquivo recente</p>
      <p className="mt-1 text-[12px] text-doqyn-muted">Envie um documento para começar</p>
      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={onUploadClick}>
        Enviar documento
      </Button>
    </div>
  );
}
