import { DrawerSection } from '@/components/ui/DrawerSection';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { formatDateTime } from '@/lib/utils';
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

  if (compact) {
    return (
      <DrawerSection label="Versões" data-testid="update-version-history-summary">
        <div className="flex flex-wrap items-center gap-1.5">
          {versions.map((version) => (
            <VersionBadge
              key={version.versionId}
              version={version.versionLabel ?? version.versionId}
              isCurrent={version.isCurrent ?? version.versionLabel === currentVersionLabel}
            />
          ))}
          <span className="font-mono text-micro text-doqyn-subtle">→</span>
          <span className="font-mono text-micro tabular-nums text-doqyn-primary">
            {nextVersionLabel}
          </span>
        </div>
      </DrawerSection>
    );
  }

  return (
    <DrawerSection
      label="Histórico de versões"
      aside={
        <span className="font-mono text-micro tabular-nums text-doqyn-subtle">
          próxima {nextVersionLabel}
        </span>
      }
      data-testid="update-version-history-summary"
    >
      {/* Linha de registro, separada por fio: a lista de versões estava dentro
          de uma pilha de cartõezinhos, um por versão. */}
      <ul className="scrollbar-thin max-h-48 overflow-y-auto">
        {versions.map((version) => (
          <li
            key={version.versionId}
            className="flex items-center justify-between gap-3 border-b border-doqyn-border-subtle/50 py-2 last:border-0"
          >
            <div className="min-w-0">
              <VersionBadge
                version={version.versionLabel ?? version.versionId}
                isCurrent={version.isCurrent ?? version.versionLabel === currentVersionLabel}
              />
              <p className="mt-1 truncate text-caption text-doqyn-text">
                {version.finalFileName ?? version.originalFileName ?? '—'}
              </p>
            </div>
            <span className="shrink-0 font-mono text-micro tabular-nums text-doqyn-subtle">
              {version.createdAt ? formatDateTime(version.createdAt) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </DrawerSection>
  );
}
