import type { ExtractedMetadata } from '@/features/document-send/types';
import { ConfidenceBadge } from '@/features/document-send/components/ConfidenceBadge';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { VersionComparisonPanel } from './VersionComparisonPanel';
import type { VersionComparisonRow } from '../types';

type NewVersionReviewStepProps = {
  fileName: string;
  metadata: ExtractedMetadata;
  comparisonRows: VersionComparisonRow[];
  currentVersionLabel: string;
  nextVersionLabel: string;
  requiresReview: boolean;
  reviewChecked: boolean;
  onReviewCheckedChange: (checked: boolean) => void;
};

function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-[12px] text-doqyn-text">{value || '—'}</dd>
    </div>
  );
}

export function NewVersionReviewStep({
  fileName,
  metadata,
  comparisonRows,
  currentVersionLabel,
  nextVersionLabel,
  requiresReview,
  reviewChecked,
  onReviewCheckedChange,
}: NewVersionReviewStepProps) {
  return (
    <div className="space-y-3" data-testid="update-version-review-step">
      <section className="rounded-xl border border-doqyn-border-subtle bg-doqyn-bg/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-doqyn-muted">
              Revisão da nova versão
            </p>
            <TruncatedText className="mt-1 text-[12px] text-doqyn-text">{fileName}</TruncatedText>
          </div>
          <ConfidenceBadge score={metadata.confidenceScore} />
        </div>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <ReviewField label="Categoria" value={metadata.documentType} />
          <ReviewField label="Nome sugerido" value={metadata.suggestedName} />
          <ReviewField label="Versão" value={`${currentVersionLabel} → ${nextVersionLabel}`} />
          <ReviewField
            label="Status"
            value={metadata.analysisStatus === 'requires_review' ? 'Requer revisão' : 'Concluída'}
          />
        </dl>
      </section>

      <VersionComparisonPanel
        rows={comparisonRows}
        currentVersionLabel={currentVersionLabel}
        nextVersionLabel={nextVersionLabel}
      />

      {requiresReview && (
        <label className="flex items-start gap-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-warning/5 px-3 py-2.5 text-[11px] text-doqyn-text">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={reviewChecked}
            onChange={(event) => onReviewCheckedChange(event.target.checked)}
          />
          <span>
            Revisei os metadados extraídos e confirmo que a nova versão pode ser criada.
          </span>
        </label>
      )}
    </div>
  );
}
