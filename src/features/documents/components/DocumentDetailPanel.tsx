import { Icon } from '@/components/ui/Icon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDate } from '@/lib/utils';
import type { DocumentStatus } from '@/types/document';
import type { DocumentVersionSummary } from '@/types/document-library';
import {
  fetchDocumentDownloadBlob,
  triggerBlobDownload,
} from '../api/documentsApi.blobs';
import { getPreviewErrorMessage, getPreviewStatusLabel } from '../utils/previewErrors';
import { DocumentPreviewViewer } from './DocumentPreviewViewer';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { useDocumentDetail } from '../hooks/useDocuments';
import { DocumentApiError } from '../api/documentsApi.errors';

type DocumentDetailPanelProps = {
  documentId: string | null;
  initialFocusPreview?: boolean;
};

export function DocumentDetailPanel({
  documentId,
  initialFocusPreview = false,
}: DocumentDetailPanelProps) {
  const navigate = useNavigate();
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const { data, isLoading, error } = useDocumentDetail(documentId);

  const activeVersionId = useMemo(() => {
    if (!data) return null;
    return selectedVersionId ?? data.latestVersion?.versionId ?? data.document.latestVersionId ?? null;
  }, [data, selectedVersionId]);

  const activeVersion = data?.versions.find(
    (version: DocumentVersionSummary) => version.versionId === activeVersionId,
  ) ?? null;
  const displayName =
    activeVersion?.finalFileName ??
    data?.document.currentFileName ??
    data?.document.displayName ??
    'Documento';

  useEffect(() => {
    if (!initialFocusPreview || !data?.permissions.canPreview || !activeVersionId) return;
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialFocusPreview, data, activeVersionId]);

  const detailErrorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof DocumentApiError) {
      return getPreviewErrorMessage(error);
    }
    if (error instanceof Error) return error.message;
    return 'Não foi possível carregar os detalhes do documento.';
  }, [error]);

  const handleDownload = async () => {
    if (!documentId || !activeVersionId || !data?.permissions.canDownload) return;

    try {
      const { blob, fileName } = await fetchDocumentDownloadBlob({
        documentId,
        versionId: activeVersionId,
      });
      triggerBlobDownload(blob, fileName);
    } catch (downloadError) {
      showApiErrorToast(downloadError, 'Não foi possível baixar o documento.');
    }
  };

  if (!documentId) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Detalhes do documento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-doqyn-muted">
            Selecione um documento na tabela para visualizar o preview e os metadados.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardContent className="py-8 text-sm text-doqyn-muted">Carregando documento...</CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="h-fit">
        <CardContent className="py-8 text-sm text-doqyn-danger">
          {detailErrorMessage ?? 'Não foi possível carregar os detalhes do documento.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="break-words">{displayName}</CardTitle>
              <p className="mt-1 text-xs text-doqyn-muted">
                {data.document.categoryName ?? data.document.documentType}
              </p>
            </div>
            <StatusPill status={(data.document.status as DocumentStatus) ?? 'active'} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-doqyn-muted">Criado em</p>
              <p className="text-sm text-doqyn-text">{formatDate(data.document.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Atualizado em</p>
              <p className="text-sm text-doqyn-text">{formatDate(data.document.updatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Enviado por</p>
              <p className="text-sm text-doqyn-text">
                {data.document.createdBy?.displayName ?? data.document.ownerName ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Preview</p>
              <p className="text-sm text-doqyn-text">
                {getPreviewStatusLabel(activeVersion?.preview?.status ?? data.document.preview?.status)}
              </p>
            </div>
          </div>

          {data.versions.length > 1 && (
            <Select
              id="document-version"
              label="Versão"
              value={activeVersionId ?? ''}
              onChange={(event) => setSelectedVersionId(event.target.value)}
              options={data.versions.map((version: DocumentVersionSummary) => ({
                value: version.versionId,
                label: `${version.versionLabel ?? version.versionId} — ${version.finalFileName ?? 'sem nome'}`,
              }))}
            />
          )}

          {data.versions.length === 1 && activeVersion?.versionLabel && (
            <div className="flex items-center gap-2 text-sm text-doqyn-muted">
              <span>Versão</span>
              <span className="rounded bg-doqyn-bg/60 px-2 py-0.5 text-xs font-medium text-doqyn-text">
                {activeVersion.versionLabel}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {data.permissions.canDownload && activeVersionId && (
              <Button variant="secondary" size="sm" onClick={() => void handleDownload()}>
                <Icon name="download" size={14} />
                Baixar original
              </Button>
            )}
            {data.permissions.canViewTracking && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate(`/tracking?documentId=${encodeURIComponent(documentId)}`)
                }
              >
                <Icon name="history" size={14} />
                Ver tracking
              </Button>
            )}
          </div>
        </CardHeader>

        {Object.keys(data.metadata).length > 0 && (
          <CardContent>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
              Metadados
            </p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(data.metadata)
                .slice(0, 8)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-doqyn-muted">{key}</dt>
                    <dd className="text-doqyn-text">{String(value ?? '—')}</dd>
                  </div>
                ))}
            </dl>
          </CardContent>
        )}
      </Card>

      {data.permissions.canPreview && activeVersionId ? (
        <div ref={previewSectionRef}>
          <DocumentPreviewViewer
            documentId={documentId}
            versionId={activeVersionId}
            fileName={displayName}
            canDownload={data.permissions.canDownload}
            onDownload={() => void handleDownload()}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-doqyn-muted">
            Você não tem permissão para visualizar este documento.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
