import { VersionBadge } from '@/components/ui/VersionBadge';
import { formatDate } from '@/lib/utils';
import type { DocumentVersionSummary } from '@/types/document-library';

type VersionHistorySummaryProps = {
  currentVersionLabel: string;
  nextVersionLabel: string;
  versions: DocumentVersionSummary[];
  compact?: boolean;
};

export function VersionHistorySummary({
  currentVersionLabel,
  nextVersionLabel,
  versions,
  compact = false,
}: VersionHistorySummaryProps) {
  if (versions.length === 0) return null;

  return (
    <section
      className={
        compact
          ? 'flex flex-wrap items-center gap-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30 px-3 py-2'
          : 'rounded-xl border border-doqyn-border-subtle bg-doqyn-surface/50 p-4'
      }
      data-testid="update-version-history-summary"
    >
      {compact ? (
        <>
          <span className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
            Versões
          </span>
          {versions.map((version) => (
            <VersionBadge
              key={version.versionId}
              version={version.versionLabel ?? version.versionId}
              isCurrent={version.isCurrent ?? version.versionLabel === currentVersionLabel}
            />
          ))}
          <span className="text-[10px] text-doqyn-muted">→</span>
          <span className="text-[11px] font-medium text-doqyn-primary">{nextVersionLabel}</span>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-doqyn-text">Histórico de versões</p>
            <p className="text-[11px] text-doqyn-muted">
              Próxima versão será{' '}
              <span className="font-medium text-doqyn-primary">{nextVersionLabel}</span>
            </p>
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {versions.map((version) => (
              <li
                key={version.versionId}
                className="flex items-center justify-between gap-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <VersionBadge
                    version={version.versionLabel ?? version.versionId}
                    isCurrent={version.isCurrent ?? version.versionLabel === currentVersionLabel}
                  />
                  <p className="mt-1 truncate text-[12px] text-doqyn-text">
                    {version.finalFileName ?? version.originalFileName ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-doqyn-muted">
                  {version.createdAt ? formatDate(version.createdAt) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
