import { Select } from '@/components/ui/Select';
import type { DocumentDetailResponse, DocumentVersionSummary } from '@/types/document-library';
import { DocumentDetailsSections } from './DocumentDetailsShared';

type DocumentViewerDetailsPanelProps = {
  data: DocumentDetailResponse;
  activeVersionId: string | null;
  activeVersion: DocumentVersionSummary | null;
  displayName: string;
  onSelectVersion: (versionId: string) => void;
};

export function DocumentViewerDetailsPanel({
  data,
  activeVersionId,
  activeVersion,
  displayName,
  onSelectVersion,
}: DocumentViewerDetailsPanelProps) {
  const versionSlot =
    data.versions.length > 1 ? (
      <Select
        id="viewer-document-version"
        label="Versão"
        value={activeVersionId ?? ''}
        onChange={(event) => onSelectVersion(event.target.value)}
        options={data.versions.map((version) => ({
          value: version.versionId,
          label: `${version.versionLabel ?? version.versionId} — ${version.finalFileName ?? 'sem nome'}`,
        }))}
      />
    ) : activeVersion?.versionLabel ? (
      <div>
        <p className="text-[11px] text-doqyn-muted">Versão</p>
        <p className="text-[12px] text-doqyn-text">{activeVersion.versionLabel}</p>
      </div>
    ) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <DocumentDetailsSections
        document={data.document}
        metadata={data.metadata}
        searchMeta={data.searchMeta}
        displayName={displayName}
        previewStatus={activeVersion?.preview?.status ?? data.document.preview?.status}
        showPreviewStatus
        versionSlot={versionSlot}
      />
    </div>
  );
}
