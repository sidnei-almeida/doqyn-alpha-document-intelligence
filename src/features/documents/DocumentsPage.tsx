import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { ListDetailLayout } from '@/components/layout/ListDetailLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { DOCUMENT_TYPES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { MOCK_DOCUMENTS } from '@/features/documents/mock-data';
import type { Document } from '@/types/document';
import { History, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DocumentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const { data } = useQuery({
    queryKey: ['documents', search, statusFilter, typeFilter, areaFilter],
    queryFn: async () => {
      try {
        const result = await api.documents.list({
          search,
          status: statusFilter,
          type: typeFilter,
          area: areaFilter,
        });
        return result.documents as Document[];
      } catch {
        return MOCK_DOCUMENTS;
      }
    },
  });

  const documents = (data ?? MOCK_DOCUMENTS).filter((doc) => {
    const matchesSearch =
      !search ||
      doc.displayName.toLowerCase().includes(search.toLowerCase()) ||
      doc.documentType.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || doc.status === statusFilter;
    const matchesType = !typeFilter || doc.documentType === typeFilter;
    const matchesArea = !areaFilter || doc.area === areaFilter;
    return matchesSearch && matchesStatus && matchesType && matchesArea;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Documentos"
        description="Consulte, filtre e gerencie documentos com histórico preservado."
        actions={
          <Button onClick={() => navigate('/upload')}>
            <Upload className="h-4 w-4" />
            Enviar documento
          </Button>
        }
      />

      <ListDetailLayout
        toolbar={
          <FilterToolbar>
            <div className="min-w-[200px] flex-1">
              <Input
                id="doc-search"
                label="Buscar"
                placeholder="Nome ou tipo de documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              id="doc-status"
              label="Status"
              options={[
                { value: '', label: 'Todos' },
                { value: 'processed', label: 'Processado' },
                { value: 'analyzing', label: 'Em análise' },
                { value: 'updated', label: 'Atualizado' },
                { value: 'pending_review', label: 'Aguardando revisão' },
                { value: 'needs_review', label: 'Requer revisão' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-w-[140px] sm:w-[160px]"
            />
            <Select
              id="doc-type"
              label="Tipo"
              options={[
                { value: '', label: 'Todos' },
                ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t })),
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full min-w-[140px] sm:w-[160px]"
            />
            <Select
              id="doc-area"
              label="Área"
              options={[
                { value: '', label: 'Todas' },
                { value: 'Financeiro', label: 'Financeiro' },
                { value: 'Frete', label: 'Frete' },
                { value: 'Jurídico', label: 'Jurídico' },
                { value: 'RH', label: 'RH' },
              ]}
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full min-w-[140px] sm:w-[160px]"
            />
            <p className="hidden pb-0.5 text-xs text-doqyn-muted sm:block">
              {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
            </p>
          </FilterToolbar>
        }
        list={
          <DataTable
            data={documents}
            keyExtractor={(d) => d.id}
            selectedKey={selectedDoc?.id}
            onRowClick={setSelectedDoc}
            columns={[
              {
                key: 'name',
                header: 'Documento',
                render: (d) => (
                  <span className="font-medium text-doqyn-text">{d.displayName}</span>
                ),
              },
              { key: 'type', header: 'Tipo', render: (d) => d.documentType },
              { key: 'area', header: 'Área', render: (d) => d.area },
              {
                key: 'status',
                header: 'Status',
                render: (d) => <StatusPill status={d.status} />,
              },
              {
                key: 'version',
                header: 'Versão',
                render: (d) => <VersionBadge version={d.version} isCurrent />,
              },
              {
                key: 'updated',
                header: 'Última atualização',
                render: (d) => (
                  <span className="text-doqyn-muted">{formatDate(d.updatedAt)}</span>
                ),
              },
            ]}
          />
        }
        detail={
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Detalhes do documento</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDoc ? (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-doqyn-muted">Nome</p>
                    <p className="font-medium text-doqyn-text">{selectedDoc.displayName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-doqyn-muted">Tipo</p>
                      <p className="text-doqyn-text">{selectedDoc.documentType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-doqyn-muted">Área</p>
                      <p className="text-doqyn-text">{selectedDoc.area}</p>
                    </div>
                    <div>
                      <p className="text-xs text-doqyn-muted">Status</p>
                      <StatusPill status={selectedDoc.status} />
                    </div>
                    <div>
                      <p className="text-xs text-doqyn-muted">Versão</p>
                      <VersionBadge version={selectedDoc.version} isCurrent />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-doqyn-muted">Responsável</p>
                    <p className="text-doqyn-text">{selectedDoc.ownerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-doqyn-muted">Grupos de acesso</p>
                    <p className="text-doqyn-text">{selectedDoc.accessGroups.join(', ')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/audit', { state: { documentId: selectedDoc.id } })}
                    >
                      <History className="h-3.5 w-3.5" />
                      Ver histórico
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate('/versioning', { state: { documentId: selectedDoc.id } })
                      }
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Nova versão
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-doqyn-muted">
                  Selecione um documento na tabela para ver os detalhes.
                </p>
              )}
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
