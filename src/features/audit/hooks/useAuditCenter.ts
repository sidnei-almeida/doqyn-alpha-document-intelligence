import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { useAuth } from '@/features/auth/useAuth';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  usersApi,
} from '@/features/users/api/usersApi';
import { invalidateUserManagementQueries } from '@/features/users/userManagementQueries';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import type { AuditEvent, AuditEventFilters, AuditOverview } from '@/types/audit';
import { auditApi } from '../api/auditApi';
import {
  approveDocumentUploadApproval,
  rejectDocumentUploadApproval,
} from '../api/documentUploadApprovalsApi';
import { listPendingApprovals, type PendingApprovalItem } from '../api/pendingApprovalsApi';
import {
  buildAuditEventsQuery,
  dedupeAuditEvents,
  isAuditAdmin,
  resolveEventFiltersForTab,
  type AuditTabId,
} from '../utils/auditDisplay';

const EMPTY_OVERVIEW: AuditOverview = {
  pendingCount: 0,
  pendingUsersCount: 0,
  todayEventsCount: 0,
  criticalEventsCount: 0,
  totalEventsCount: 0,
};

const EVENTS_PAGE_SIZE = 50;

export function useAuditCenter(documentId?: string) {
  const { user, roles, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = isAuditAdmin(roles, user?.role);
  const isDoqynAdmin = hasRole('doqyn_admin');
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
    queryFn: () => listPendingApprovals(isDoqynAdmin ? tenantId : undefined),
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

  const approveMutation = useMutation({
    mutationFn: ({
      item,
      platformRoles,
      accessGroupIds,
      documentGroupIds,
    }: {
      item: PendingApprovalItem;
      platformRoles: Parameters<typeof usersApi.approve>[1]['platformRoles'];
      accessGroupIds: string[];
      documentGroupIds: string[];
    }) =>
      usersApi.approve(
        item.membershipId,
        {
          platformRoles,
          accessGroupIds,
          documentGroupIds,
          notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
        },
        isDoqynAdmin ? tenantId : undefined,
      ),
    onSuccess: async () => {
      toast.success('Solicitação aprovada com sucesso.');
      await invalidateAll();
    },
    onError: (error: Error) => showApiErrorToast(error, 'Não foi possível concluir a ação.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ item, reason }: { item: PendingApprovalItem; reason: string }) => {
      if (item.type === 'document_upload' && item.documentUpload?.approvalId) {
        return rejectDocumentUploadApproval(item.documentUpload.approvalId, reason).then(() => undefined);
      }
      return usersApi.reject(item.membershipId, reason, isDoqynAdmin ? tenantId : undefined);
    },
    onSuccess: async () => {
      toast.success('Solicitação rejeitada.');
      await invalidateAll();
      await queryClient.invalidateQueries({ queryKey: ['audit-pending', tenantId] });
    },
    onError: (error: Error) => showApiErrorToast(error, 'Não foi possível concluir a ação.'),
  });

  const approveDocumentUploadMutation = useMutation({
    mutationFn: (approvalId: string) => approveDocumentUploadApproval(approvalId),
    onSuccess: async () => {
      toast.success('Documento aprovado e disponível na Biblioteca.');
      await invalidateAll();
      await queryClient.invalidateQueries({ queryKey: ['audit-pending', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['library-documents'] });
    },
    onError: (error: Error) => showApiErrorToast(error, 'Não foi possível aprovar o envio.'),
  });

  const pendingItems = pendingQuery.data ?? [];
  const pendingCount = pendingItems.length;

  const overview: AuditOverview = {
    ...(overviewQuery.data ?? EMPTY_OVERVIEW),
    pendingCount,
    pendingUsersCount: pendingCount,
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
    isDoqynAdmin,
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
    approveMutation,
    rejectMutation,
    approveDocumentUploadMutation,
    refresh: invalidateAll,
  };
}
