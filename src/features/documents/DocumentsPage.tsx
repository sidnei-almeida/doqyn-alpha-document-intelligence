import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useNavigate } from 'react-router-dom';
import { FilterBar, FilterBarField } from '@/components/ui/FilterBar';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { DateInput } from '@/components/ui/DateInput';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { TruncatedText } from '@/components/ui/TruncatedText';
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
        <Button onClick={() => navigate('/biblioteca')}>
          <Icon name="upload" size={ICON_SIZE.xs} />
          Ir para a Biblioteca
        </Button>
      }
      bodyClassName="min-h-0"
    >
      <FilterBar
        showClear={hasActiveFilters}
        onClear={clearFilters}
        summary={`${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}`}
      >
        <FilterBarField span={2}>
          <Input
            id="doc-search"
            label="Buscar"
            placeholder="Nome ou categoria..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </FilterBarField>
        <FilterBarField>
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
          />
        </FilterBarField>
        <FilterBarField>
          <Select
            id="doc-category"
            label="Categoria"
            options={[
              { value: '', label: 'Todas' },
              ...categories.map((category) => ({ value: category.id, label: category.name })),
            ]}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </FilterBarField>
        <FilterBarField>
          <DateInput
            id="doc-from"
            label="De"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </FilterBarField>
        <FilterBarField>
          <DateInput
            id="doc-to"
            label="Até"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </FilterBarField>
      </FilterBar>

      <DataTable
        stretch
        className="flex-1"
        data={isLoading ? [] : documents}
        keyExtractor={(d) => d.documentId}
        onRowClick={(doc) => openDocument(doc.documentId, 'details')}
        emptyMessage={emptyMessage}
        emptyDescription={
          hasActiveFilters
            ? 'Tente remover ou ajustar os filtros para ampliar a busca.'
            : 'Envie documentos para começar a montar a biblioteca.'
        }
        emptyAction={
          hasActiveFilters ? (
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => navigate('/biblioteca')}>
              Enviar documento
            </Button>
          )
        }
        sparseMessage="Nenhum outro documento para os filtros atuais"
        sparseDescription="Amplie o período ou ajuste os filtros para ver mais registros."
        sparseAction={
          hasActiveFilters ? (
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Ajustar filtros
            </Button>
          ) : undefined
        }
        columns={[
          {
            key: 'name',
            header: 'Documento',
            render: (doc: DocumentListItem) => (
              <TruncatedText className="max-w-[280px] font-medium">
                {doc.currentFileName ?? doc.displayName}
              </TruncatedText>
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
            headerClassName: 'text-right',
            className: 'text-right',
            render: (doc) => (
              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  label="Detalhes"
                  onClick={() => openDocument(doc.documentId, 'details')}
                >
                  <Icon name="description" size={ICON_SIZE.xs} />
                </IconButton>
                {doc.permissions?.canPreview !== false && (
                  <IconButton
                    label={
                      doc.latestVersionId
                        ? 'Visualizar'
                        : 'Versão não disponível para este documento.'
                    }
                    onClick={() => openDocument(doc.documentId, 'preview')}
                    disabled={!doc.latestVersionId}
                  >
                    <Icon name="visibility" size={ICON_SIZE.xs} />
                  </IconButton>
                )}
                {doc.permissions?.canDownload && (
                  <IconButton
                    label={
                      doc.latestVersionId
                        ? 'Baixar original'
                        : 'Versão não disponível para este documento.'
                    }
                    onClick={() => void handleDownload(doc)}
                    disabled={!doc.latestVersionId}
                  >
                    <Icon name="download" size={ICON_SIZE.xs} />
                  </IconButton>
                )}
                {doc.permissions?.canViewTracking && (
                  <IconButton
                    label="Ver tracking"
                    onClick={() =>
                      navigate(`/tracking?documentId=${encodeURIComponent(doc.documentId)}`)
                    }
                  >
                    <Icon name="history" size={ICON_SIZE.xs} />
                  </IconButton>
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
