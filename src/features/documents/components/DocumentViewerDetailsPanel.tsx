import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { formatDate } from '@/lib/utils';
import type { DocumentStatus } from '@/types/document';
import type { DocumentDetailResponse, DocumentVersionSummary } from '@/types/document-library';
import { getPreviewStatusLabel } from '../utils/previewErrors';

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
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-doqyn-muted">Documento</p>
        <TruncatedText className="mt-1 break-words text-sm font-medium text-doqyn-text">
          {displayName}
        </TruncatedText>
      </div>

      <div className="flex items-center gap-2">
        <StatusPill status={(data.document.status as DocumentStatus) ?? 'active'} />
        <span className="text-xs text-doqyn-muted">
          {getPreviewStatusLabel(activeVersion?.preview?.status ?? data.document.preview?.status)}
        </span>
      </div>

      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-xs text-doqyn-muted">Categoria</dt>
          <dd className="text-doqyn-text">
            {data.document.categoryName ?? data.document.documentType ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-doqyn-muted">Enviado por</dt>
          <dd className="text-doqyn-text">
            {data.document.createdBy?.displayName ?? data.document.ownerName ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-doqyn-muted">Criado em</dt>
          <dd className="text-doqyn-text">{formatDate(data.document.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-doqyn-muted">Atualizado em</dt>
          <dd className="text-doqyn-text">{formatDate(data.document.updatedAt)}</dd>
        </div>
      </dl>

      {data.versions.length > 1 ? (
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
          <p className="text-xs text-doqyn-muted">Versão</p>
          <p className="text-sm text-doqyn-text">{activeVersion.versionLabel}</p>
        </div>
      ) : null}

      {Object.keys(data.metadata).length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
            Metadados
          </p>
          <dl className="grid gap-2 text-sm">
            {Object.entries(data.metadata)
              .slice(0, 12)
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-doqyn-muted">{key}</dt>
                  <dd className="break-words text-doqyn-text">{String(value ?? '—')}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}
