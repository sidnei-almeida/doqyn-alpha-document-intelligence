import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Download, Eye, FileText, History, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { formatDate } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import type { DocumentStatus } from '@/types/document';
import { DocumentViewerModal } from './viewer';
import { getPreviewStatusLabel } from './utils/previewErrors';
import { useDocuments } from './hooks/useDocuments';
import {
  downloadDocument,
  fetchDocumentCategories,
  triggerBlobDownload,
} from './api/documentsApi';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';

export function DocumentsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'details' | 'preview'>('details');

  const search = useDeferredValue(searchInput);

  const filters = {
    search,
    status: statusFilter,
    categoryId: categoryFilter,
    from: fromDate,
    to: toDate,
  };

  const { data: documents = [], isLoading, isError } = useDocuments(filters);

  const { data: categories = [] } = useQuery({
    queryKey: ['document-categories-options'],
    queryFn: fetchDocumentCategories,
  });

  const openDocument = (documentId: string, mode: 'details' | 'preview' = 'details') => {
    setViewerMode(mode);
    setSelectedDocId(documentId);
  };

  const handleDownload = async (doc: DocumentListItem) => {
    if (!doc.permissions?.canDownload) return;
    if (!doc.latestVersionId) {
      showApiErrorToast(
        new Error('Versão não disponível para este documento.'),
        'Versão não disponível para este documento.',
      );
      return;
    }
    try {
      const { blob, fileName } = await downloadDocument(doc.documentId, doc.latestVersionId);
      triggerBlobDownload(blob, fileName || doc.currentFileName);
    } catch (error) {
      showApiErrorToast(error, 'Não foi possível baixar o documento.');
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setCategoryFilter('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = Boolean(
    searchInput || statusFilter || categoryFilter || fromDate || toDate,
  );

  const emptyMessage = isLoading
    ? 'Carregando documentos...'
    : isError
      ? 'Não foi possível carregar os documentos agora.'
      : hasActiveFilters
        ? 'Nenhum documento encontrado para os filtros selecionados.'
        : 'Nenhum documento encontrado neste ambiente.';

  return (
    <PageShell
      eyebrow="Biblioteca"
      title="Documentos"
      description="Consulte, visualize e baixe documentos com preview seguro e rastreabilidade."
      actions={
        <Button onClick={() => navigate('/upload')}>
          <Upload className="h-4 w-4" />
          Enviar documento
        </Button>
      }
      bodyClassName="min-h-0"
    >
      <FilterToolbar>
        <div className="min-w-[200px] flex-1">
          <Input
            id="doc-search"
            label="Buscar"
            placeholder="Nome ou categoria..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          id="doc-status"
          label="Status"
          options={[
            { value: '', label: 'Todos' },
            { value: 'active', label: 'Ativo' },
            { value: 'processed', label: 'Processado' },
            { value: 'analyzing', label: 'Em análise' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full min-w-[140px] sm:w-[160px]"
        />
        <Select
          id="doc-category"
          label="Categoria"
          options={[
            { value: '', label: 'Todas' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full min-w-[140px] sm:w-[180px]"
        />
        <Input
          id="doc-from"
          label="De"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-full min-w-[140px] sm:w-[160px]"
        />
        <Input
          id="doc-to"
          label="Até"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-full min-w-[140px] sm:w-[160px]"
        />
        {hasActiveFilters && (
          <Button variant="secondary" size="sm" onClick={clearFilters} className="self-end">
            Limpar filtros
          </Button>
        )}
        <p className="hidden pb-0.5 text-xs text-doqyn-muted sm:block">
          {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
        </p>
      </FilterToolbar>

      <DataTable
        stretch
        className="min-h-[420px] flex-1"
        data={documents}
        keyExtractor={(d) => d.documentId}
        onRowClick={(doc) => openDocument(doc.documentId, 'details')}
        emptyMessage={emptyMessage}
        columns={[
          {
            key: 'name',
            header: 'Documento',
            render: (doc: DocumentListItem) => (
              <span className="font-medium text-doqyn-text" title={doc.currentFileName}>
                {doc.currentFileName ?? doc.displayName}
              </span>
            ),
          },
          {
            key: 'type',
            header: 'Categoria',
            render: (doc) => doc.categoryName ?? doc.documentType ?? '—',
          },
          {
            key: 'status',
            header: 'Status',
            render: (doc) => <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} />,
          },
          {
            key: 'preview',
            header: 'Preview',
            render: (doc) => (
              <span className="text-xs text-doqyn-muted">
                {getPreviewStatusLabel(doc.preview?.status)}
              </span>
            ),
          },
          {
            key: 'owner',
            header: 'Enviado por',
            render: (doc) => doc.createdBy?.displayName ?? doc.ownerName ?? '—',
          },
          {
            key: 'updated',
            header: 'Data',
            render: (doc) => (
              <span className="text-doqyn-muted">{formatDate(doc.updatedAt)}</span>
            ),
          },
          {
            key: 'version',
            header: 'Versão',
            render: (doc) => (
              <VersionBadge version={doc.versionLabel ?? `v${doc.version}`} isCurrent />
            ),
          },
          {
            key: 'actions',
            header: 'Ações',
            render: (doc) => (
              <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openDocument(doc.documentId, 'details')}
                  title="Detalhes"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                {doc.permissions?.canPreview !== false && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openDocument(doc.documentId, 'preview')}
                    title={
                      doc.latestVersionId
                        ? 'Visualizar'
                        : 'Versão não disponível para este documento.'
                    }
                    disabled={!doc.latestVersionId}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
                {doc.permissions?.canDownload && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDownload(doc)}
                    title={
                      doc.latestVersionId
                        ? 'Baixar original'
                        : 'Versão não disponível para este documento.'
                    }
                    disabled={!doc.latestVersionId}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                {doc.permissions?.canViewTracking && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate(`/tracking?documentId=${encodeURIComponent(doc.documentId)}`)
                    }
                    title="Ver tracking"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <DocumentViewerModal
        open={Boolean(selectedDocId)}
        documentId={selectedDocId}
        initialShowDetails={viewerMode === 'details'}
        onClose={() => setSelectedDocId(null)}
      />
    </PageShell>
  );
}
