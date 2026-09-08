import { i18n } from '@/i18n';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { useAuth } from '@/features/auth/useAuth';
import { usersApi } from '@/features/users/api/usersApi';
import { invalidateUserManagementQueries } from '@/features/users/userManagementQueries';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import type { AuditEvent, AuditEventFilters, AuditOverview } from '@/types/audit';
import { auditApi } from '../api/auditApi';
import {
  decideApprovalRequest,
  listPendingApprovals,
  type PendingApprovalItem,
} from '../api/pendingApprovalsApi';
import {
  buildAuditEventsQuery,
  dedupeAuditEvents,
  isAuditAdmin,
  resolveEventFiltersForTab,
  type AuditTabId,
} from '../utils/auditDisplay';

const EMPTY_OVERVIEW: AuditOverview = {
  pendingCount: 0,
  todayEventsCount: 0,
  criticalEventsCount: 0,
  totalEventsCount: 0,
};

const EVENTS_PAGE_SIZE = 50;

/**
 * O aviso de sucesso diz o que aconteceu, e cada tipo faz coisa diferente.
 *
 * Aprovar um envio publica o documento; aprovar um compartilhamento o entrega a alguém; aprovar um
 * download só libera quem pediu. Uma frase só para os três diria a verdade em um caso e mentiria
 * nos outros dois.
 */
const APPROVED_MESSAGE: Record<string, string> = {
  document_upload: 'Documento aprovado e disponível na Biblioteca.',
  document_download: 'Download liberado para o solicitante.',
  document_share: 'Compartilhamento aprovado e concedido.',
};

export function useAuditCenter(documentId?: string) {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = isAuditAdmin(roles, user?.role);
  const tenantId = user?.companyId ?? '';

  const [eventsTab, setEventsTab] = useState<Exclude<AuditTabId, 'pending'>>('events');
  const [eventFilters, setEventFilters] = useState<AuditEventFilters>({
    documentId,
  });

  const resolvedEventFilters = useMemo(
    () => resolveEventFiltersForTab(eventsTab, { ...eventFilters, documentId }),
    [documentId, eventFilters, eventsTab],
  );

  const eventQueryParams = useMemo(
    () => buildAuditEventsQuery(resolvedEventFilters),
    [resolvedEventFilters],
  );

  const overviewQuery = useQuery({
    queryKey: ['audit-overview', tenantId],
    queryFn: () => auditApi.getOverview(),
    enabled: Boolean(tenantId),
    ...tenantLiveSyncQueryOptions(),
  });

  const pendingQuery = useQuery({
    queryKey: ['audit-pending', tenantId],
    // O tenant vem sempre da sessão no servidor. O ramo que enviava um tenant explícito só servia
    // ao papel global de plataforma, que não existe mais.
    queryFn: () => listPendingApprovals(),
    enabled: Boolean(tenantId) && isAdmin,
    ...tenantLiveSyncQueryOptions(),
  });

  const eventsQuery = useInfiniteQuery({
    queryKey: ['audit-events', tenantId, eventsTab, eventQueryParams],
    queryFn: ({ pageParam }) =>
      auditApi.listEvents({
        ...resolvedEventFilters,
        limit: EVENTS_PAGE_SIZE,
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(tenantId),
  });

  const documentGroupsQuery = useQuery({
    queryKey: ['document-groups', tenantId],
    queryFn: () => usersApi.listDocumentGroups(),
    enabled: isAdmin && Boolean(tenantId),
    ...tenantLiveSyncQueryOptions(),
  });

  const invalidateAll = async () => {
    await invalidateUserManagementQueries(queryClient, tenantId || undefined);
  };

  const rejectMutation = useMutation({
    mutationFn: ({ item, reason }: { item: PendingApprovalItem; reason: string }) => {
      return decideApprovalRequest(item.id, 'rejected', reason);
    },
    onSuccess: async () => {
      toast.success(i18n.t('audit:toast.solicitacaoRejeitada'));
      await invalidateAll();
      await queryClient.invalidateQueries({ queryKey: ['audit-pending', tenantId] });
    },
    onError: (error: Error) => showApiErrorToast(error, 'Não foi possível concluir a ação.'),
  });

  const approveDocumentMutation = useMutation({
    mutationFn: (item: PendingApprovalItem) => decideApprovalRequest(item.id, 'approved'),
    onSuccess: async (_result, item) => {
      toast.success(APPROVED_MESSAGE[item.type] ?? 'Pedido aprovado.');
      await invalidateAll();
      await queryClient.invalidateQueries({ queryKey: ['audit-pending', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['library-documents'] });
    },
    onError: (error: Error) => showApiErrorToast(error, 'Não foi possível aprovar o pedido.'),
  });

  const pendingItems = pendingQuery.data ?? [];
  const pendingCount = pendingItems.length;

  const overview: AuditOverview = {
    ...(overviewQuery.data ?? EMPTY_OVERVIEW),
    pendingCount,
  };

  const events = useMemo(
    () =>
      dedupeAuditEvents(
        (eventsQuery.data?.pages.flatMap((page) => page.events) ?? []) as AuditEvent[],
      ),
    [eventsQuery.data?.pages],
  );

  const eventsTotal = eventsQuery.data?.pages[0]?.total ?? 0;
  const hasMoreEvents = Boolean(eventsQuery.hasNextPage);

  const loadMoreEvents = () => {
    if (!eventsQuery.hasNextPage || eventsQuery.isFetchingNextPage) return;
    void eventsQuery.fetchNextPage();
  };

  const updateEventFilters = (filters: AuditEventFilters) => {
    setEventFilters(filters);
  };

  return {
    isAdmin,
    overview,
    overviewLoading: overviewQuery.isLoading,
    overviewError: overviewQuery.isError,
    pendingItems,
    pendingLoading: pendingQuery.isLoading,
    pendingError: pendingQuery.isError,
    events,
    eventsTotal,
    eventsLoading: eventsQuery.isLoading,
    eventsFetchingMore: eventsQuery.isFetchingNextPage,
    eventsError: eventsQuery.isError,
    hasMoreEvents,
    loadMoreEvents,
    eventsTab,
    setEventsTab,
    eventFilters,
    setEventFilters: updateEventFilters,
    documentGroups: documentGroupsQuery.data ?? [],
    rejectMutation,
    approveDocumentMutation,
    refresh: invalidateAll,
  };
}
