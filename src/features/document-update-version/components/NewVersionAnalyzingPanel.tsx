import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { formatFileSize } from '@/features/document-send/utils/validateUpload';
import { cn } from '@/lib/utils';

type NewVersionAnalyzingPanelProps = {
  fileName: string;
  fileSize: number;
  currentVersionLabel: string;
  nextVersionLabel: string;
  fillHeight?: boolean;
};

const ANALYSIS_STEPS = [
  { id: 'ocr', label: 'Extraindo texto do PDF' },
  { id: 'classify', label: 'Classificando documento' },
  { id: 'metadata', label: 'Extraindo metadados' },
  { id: 'compare', label: 'Comparando com versão atual' },
] as const;

export function NewVersionAnalyzingPanel({
  fileName,
  fileSize,
  currentVersionLabel,
  nextVersionLabel,
  fillHeight = false,
}: NewVersionAnalyzingPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-doqyn-border-subtle bg-doqyn-surface/50 p-3',
        fillHeight && 'min-h-0 flex-1',
      )}
      data-testid="update-version-analyzing-panel"
    >
      <div className="mb-3 shrink-0">
        <p className="text-[12px] font-semibold text-doqyn-text">Analisando nova versão</p>
        <p className="mt-0.5 text-[11px] text-doqyn-muted">
          Comparando com {currentVersionLabel} para preparar {nextVersionLabel}.
        </p>
      </div>

      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-4 py-6 text-center',
          fillHeight && 'min-h-0 flex-1',
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-doqyn-primary/25 bg-doqyn-primary/10">
          <Icon
            name="progress_activity"
            size={ICON_SIZE.nav}
            className="animate-spin text-doqyn-primary"
          />
        </div>

        <p className="mt-4 max-w-full truncate text-[13px] font-medium text-doqyn-text">{fileName}</p>
        <p className="mt-1 text-[12px] text-doqyn-muted">{formatFileSize(fileSize)}</p>
      </div>

      <ul className="mt-3 shrink-0 space-y-1">
        {ANALYSIS_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px]',
              index === 0 ? 'bg-doqyn-primary/10 text-doqyn-text' : 'text-doqyn-muted',
            )}
          >
            <Icon
              name={index === 0 ? 'progress_activity' : 'radio_button_unchecked'}
              size={ICON_SIZE.xs}
              className={cn(index === 0 && 'animate-spin text-doqyn-primary')}
            />
            <span>{step.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
