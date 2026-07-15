import { StatusPill } from '@/components/ui/StatusPill';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { formatDate } from '@/lib/utils';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem, DocumentSearchMeta } from '@/types/document-library';
import { buildStandardDetailsFields } from '@/features/document-update-version/utils/documentMetadataDisplay';
import { getPreviewStatusLabel } from '../utils/previewErrors';

type DetailFieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

/** Linha label/valor — layout único do painel Detalhes. */
export function DocumentDetailField({ label, children, hint }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-doqyn-border-subtle py-1.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="shrink-0 text-[11px] text-doqyn-muted">{label}</dt>
        <dd className="min-w-0 break-words text-right text-[12px] text-doqyn-text">{children}</dd>
      </div>
      {hint ? <p className="text-right text-[10px] text-doqyn-muted">{hint}</p> : null}
    </div>
  );
}

type DocumentStandardFichaProps = {
  metadata?: Record<string, unknown> | null;
  searchMeta?: DocumentSearchMeta | null;
};

/** Ficha standard (partes, datas, validade) — única fonte para drawer e viewer. */
export function DocumentStandardFicha({ metadata, searchMeta }: DocumentStandardFichaProps) {
  const fields = buildStandardDetailsFields({ metadata, searchMeta });
  if (fields.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">Ficha</p>
      <dl className="divide-y divide-doqyn-border-subtle border-t border-doqyn-border-subtle">
        {fields.map((field) => (
          <DocumentDetailField key={field.key} label={field.label} hint={field.hint}>
            {field.value}
          </DocumentDetailField>
        ))}
      </dl>
    </div>
  );
}

type DocumentSystemDetailsProps = {
  document: Pick<
    DocumentListItem,
    | 'categoryName'
    | 'documentType'
    | 'ownerName'
    | 'createdBy'
    | 'updatedByName'
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'preview'
  >;
  previewStatus?: string | null;
  showPreviewStatus?: boolean;
};

export function DocumentSystemDetails({
  document,
  previewStatus,
  showPreviewStatus = false,
}: DocumentSystemDetailsProps) {
  return (
    <dl className="divide-y divide-doqyn-border-subtle border-t border-doqyn-border-subtle">
      <DocumentDetailField label="Categoria">
        {document.categoryName ?? document.documentType ?? '—'}
      </DocumentDetailField>
      <DocumentDetailField label="Proprietário">{document.ownerName ?? '—'}</DocumentDetailField>
      <DocumentDetailField label="Enviado por">
        {document.createdBy?.displayName ?? '—'}
      </DocumentDetailField>
      {document.updatedByName ? (
        <DocumentDetailField label="Última atualização por">
          {document.updatedByName}
        </DocumentDetailField>
      ) : null}
      <DocumentDetailField label="Criado">{formatDate(document.createdAt)}</DocumentDetailField>
      <DocumentDetailField label="Atualizado">{formatDate(document.updatedAt)}</DocumentDetailField>
      {showPreviewStatus ? (
        <DocumentDetailField label="Preview">
          {getPreviewStatusLabel(previewStatus ?? document.preview?.status)}
        </DocumentDetailField>
      ) : null}
    </dl>
  );
}

type DocumentDetailsSectionsProps = {
  document: DocumentListItem;
  metadata?: Record<string, unknown> | null;
  searchMeta?: DocumentSearchMeta | null;
  displayName?: string;
  previewStatus?: string | null;
  showHeader?: boolean;
  showPreviewStatus?: boolean;
  fichaLoading?: boolean;
  versionSlot?: React.ReactNode;
};

/**
 * Bloco único de detalhes (sistema + ficha).
 * Usado pelo aside do viewer e pelo drawer da biblioteca.
 */
export function DocumentDetailsSections({
  document,
  metadata,
  searchMeta,
  displayName,
  previewStatus,
  showHeader = true,
  showPreviewStatus = false,
  fichaLoading = false,
  versionSlot,
}: DocumentDetailsSectionsProps) {
  const name = displayName ?? document.currentFileName ?? document.displayName ?? 'Documento';

  return (
    <div className="flex flex-col gap-3">
      {showHeader ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
            Documento
          </p>
          <TruncatedText className="mt-1 break-words text-[13px] font-medium text-doqyn-text">
            {name}
          </TruncatedText>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusPill status={(document.status as DocumentStatus) ?? 'active'} size="xs" dot />
            {showPreviewStatus ? (
              <span className="text-[11px] text-doqyn-muted">
                {getPreviewStatusLabel(previewStatus ?? document.preview?.status)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <DocumentSystemDetails
        document={document}
        previewStatus={previewStatus}
        showPreviewStatus={showPreviewStatus}
      />

      {versionSlot}

      {fichaLoading ? (
        <p className="text-[11px] text-doqyn-muted">Carregando ficha…</p>
      ) : (
        <DocumentStandardFicha metadata={metadata} searchMeta={searchMeta} />
      )}
    </div>
  );
}
