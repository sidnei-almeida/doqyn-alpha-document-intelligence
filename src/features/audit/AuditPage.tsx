import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FilterToolbar } from '@/components/layout/FilterToolbar';
import { ListDetailLayout } from '@/components/layout/ListDetailLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AuditEventItem } from '@/components/ui/AuditEventItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import { AUDIT_ACTION_LABELS } from '@/types/audit';
import { ScrollText } from 'lucide-react';

const AUDIT_RESULT_LABELS: Record<AuditEvent['result'], string> = {
  success: 'Sucesso',
  warning: 'Atenção',
  error: 'Erro',
  info: 'Informação',
};

const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'evt-001',
    tenantId: 'tenant-001',
    documentId: 'doc-001',
    actorUserId: 'user-001',
    actorName: 'Administrador DOQYN',
    action: 'document_uploaded',
    description: 'Contrato Fornecedor 2024 enviado para análise',
    area: 'Jurídico',
    result: 'success',
    createdAt: '2025-06-15T10:30:00Z',
  },
  {
    id: 'evt-002',
    tenantId: 'tenant-001',
    documentId: 'doc-001',
    actorUserId: 'user-001',
    actorName: 'Administrador DOQYN',
    action: 'version_created',
    description: 'Nova versão v2 criada — cláusulas atualizadas',
    area: 'Jurídico',
    result: 'success',
    createdAt: '2025-06-18T14:22:00Z',
  },
  {
    id: 'evt-003',
    tenantId: 'tenant-001',
    documentId: 'doc-002',
    actorUserId: 'user-001',
    actorName: 'Administrador DOQYN',
    action: 'rule_applied',
    description: 'Regra de classificação fiscal aplicada automaticamente',
    area: 'Frete',
    result: 'info',
    createdAt: '2025-06-20T09:16:00Z',
  },
  {
    id: 'evt-004',
    tenantId: 'tenant-001',
    documentId: 'doc-003',
    actorUserId: 'user-002',
    actorName: 'Maria Silva',
    action: 'document_reviewed',
    description: 'Política de Benefícios RH marcada para revisão',
    area: 'RH',
    result: 'warning',
    createdAt: '2025-06-19T11:45:00Z',
  },
  {
    id: 'evt-005',
    tenantId: 'tenant-001',
    documentId: 'doc-001',
    actorUserId: 'user-003',
    actorName: 'Carlos Mendes',
    action: 'permission_granted',
    description: 'Acesso concedido ao grupo Financeiro',
    area: 'Financeiro',
    result: 'success',
    createdAt: '2025-06-17T08:00:00Z',
  },
  {
    id: 'evt-006',
    tenantId: 'tenant-001',
    documentId: 'doc-004',
    actorUserId: 'user-001',
    actorName: 'Administrador DOQYN',
    action: 'document_viewed',
    description: 'Relatório Financeiro Q2 visualizado',
    area: 'Financeiro',
    result: 'info',
    createdAt: '2025-06-21T10:30:00Z',
  },
];

export function AuditPage() {
  const location = useLocation();
  const filterDocId = (location.state as { documentId?: string })?.documentId;
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const { data } = useQuery({
    queryKey: ['audit', filterDocId],
    queryFn: async () => {
      try {
        const result = await api.audit.list(filterDocId ? { documentId: filterDocId } : undefined);
        return result.events as AuditEvent[];
      } catch {
        return MOCK_AUDIT_EVENTS;
      }
    },
  });

  const events = (data ?? MOCK_AUDIT_EVENTS).filter((evt) => {
    const matchesDoc = !filterDocId || evt.documentId === filterDocId;
    const matchesSearch =
      !search ||
      evt.description.toLowerCase().includes(search.toLowerCase()) ||
      evt.actorName.toLowerCase().includes(search.toLowerCase()) ||
      (AUDIT_ACTION_LABELS[evt.action] ?? evt.action)
        .toLowerCase()
        .includes(search.toLowerCase());
    return matchesDoc && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rastreabilidade"
        title="Auditoria"
        description="Histórico completo de ações, acessos e alterações em documentos."
      />

      {filterDocId && (
        <p className="rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-2.5 text-sm text-doqyn-muted">
          Exibindo eventos do documento{' '}
          <span className="font-mono text-doqyn-text">{filterDocId}</span>
        </p>
      )}

      <ListDetailLayout
        toolbar={
          <FilterToolbar>
            <div className="min-w-[220px] flex-1">
              <Input
                id="audit-search"
                label="Buscar eventos"
                placeholder="Ação, usuário ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="pb-0.5 text-xs text-doqyn-muted">
              {events.length} {events.length === 1 ? 'evento' : 'eventos'}
            </p>
          </FilterToolbar>
        }
        list={
          events.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-5 w-5" />}
              title="Nenhum evento encontrado"
              description="Ajuste a busca ou aguarde novas ações no sistema."
            />
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <AuditEventItem
                  key={event.id}
                  event={event}
                  isSelected={selectedEvent?.id === event.id}
                  onClick={() => setSelectedEvent(event)}
                />
              ))}
            </div>
          )
        }
        detail={
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Detalhes do evento</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEvent ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-doqyn-muted">Ação</p>
                    <p className="font-medium text-doqyn-text">
                      {AUDIT_ACTION_LABELS[selectedEvent.action]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-doqyn-muted">Descrição</p>
                    <p className="text-doqyn-text">{selectedEvent.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-doqyn-muted">Usuário</p>
                      <p className="text-doqyn-text">{selectedEvent.actorName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-doqyn-muted">Área</p>
                      <p className="text-doqyn-text">{selectedEvent.area}</p>
                    </div>
                    <div>
                      <p className="text-xs text-doqyn-muted">Resultado</p>
                      <p className="text-doqyn-text">
                        {AUDIT_RESULT_LABELS[selectedEvent.result]}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-doqyn-muted">Data/hora</p>
                      <p className="text-doqyn-text">{formatDate(selectedEvent.createdAt)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-doqyn-muted">Documento</p>
                    <p className="font-mono text-xs text-doqyn-muted">{selectedEvent.documentId}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-doqyn-muted">
                  Selecione um evento na lista para ver os detalhes completos.
                </p>
              )}
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
