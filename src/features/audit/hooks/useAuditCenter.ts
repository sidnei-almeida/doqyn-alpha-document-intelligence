import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/useAuth';
import { getAccessGroups } from '@/features/rules/api/rulesApi';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  usersApi,
} from '@/features/users/api/usersApi';
import type { AuditEvent, AuditEventFilters, AuditOverview } from '@/types/audit';
import { auditApi } from '../api/auditApi';
import { listPendingApprovals, type PendingApprovalItem } from '../api/pendingApprovalsApi';
import { buildAuditEventsQuery, isAuditAdmin } from '../utils/auditDisplay';

const EMPTY_OVERVIEW: AuditOverview = {
  pendingCount: 0,
  pendingUsersCount: 0,
  todayEventsCount: 0,
  criticalEventsCount: 0,
  totalEventsCount: 0,
};

export function useAuditCenter(documentId?: string) {
  const { user, roles, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = isAuditAdmin(roles, user?.role);
  const isDoqynAdmin = hasRole('doqyn_admin');
  const tenantId = user?.companyId;

  const [eventFilters, setEventFilters] = useState<AuditEventFilters>({
    documentId,
  });

  const eventQueryParams = useMemo(
    () => buildAuditEventsQuery({ ...eventFilters, documentId }),
    [documentId, eventFilters],
  );

  const overviewQuery = useQuery({
    queryKey: ['audit-overview', tenantId],
    queryFn: () => auditApi.getOverview(),
    enabled: Boolean(tenantId),
  });

  const pendingQuery = useQuery({
    queryKey: ['audit-pending', tenantId],
    queryFn: () => listPendingApprovals(isDoqynAdmin ? tenantId : undefined),
    enabled: Boolean(tenantId) && isAdmin,
  });

  const eventsQuery = useQuery({
    queryKey: ['audit-events', tenantId, eventQueryParams],
    queryFn: () => auditApi.listEvents(eventQueryParams),
    enabled: Boolean(tenantId),
  });

  const groupsQuery = useQuery({
    queryKey: ['access-groups', tenantId],
    queryFn: () => getAccessGroups(),
    enabled: isAdmin,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['audit-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['audit-events'] });
    void queryClient.invalidateQueries({ queryKey: ['audit-pending'] });
    void queryClient.invalidateQueries({ queryKey: ['company-members'] });
  };

  const approveMutation = useMutation({
    mutationFn: ({
      item,
      platformRoles,
      accessGroupIds,
    }: {
      item: PendingApprovalItem;
      platformRoles: Parameters<typeof usersApi.approve>[1]['platformRoles'];
      accessGroupIds: string[];
    }) =>
      usersApi.approve(
        item.membershipId,
        {
          platformRoles,
          accessGroupIds,
          notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
        },
        isDoqynAdmin ? tenantId : undefined,
      ),
    onSuccess: () => {
      toast.success('Solicitação aprovada com sucesso.');
      invalidateAll();
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível concluir a ação.'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ item, reason }: { item: PendingApprovalItem; reason: string }) =>
      usersApi.reject(item.membershipId, reason, isDoqynAdmin ? tenantId : undefined),
    onSuccess: () => {
      toast.success('Solicitação rejeitada.');
      invalidateAll();
    },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível concluir a ação.'),
  });

  const pendingItems = pendingQuery.data ?? [];
  const pendingCount = pendingItems.length;

  const overview: AuditOverview = {
    ...(overviewQuery.data ?? EMPTY_OVERVIEW),
    pendingCount,
    pendingUsersCount: pendingCount,
  };

  const events = (eventsQuery.data?.events ?? []) as AuditEvent[];

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
    eventsTotal: eventsQuery.data?.total ?? 0,
    eventsLoading: eventsQuery.isLoading,
    eventsError: eventsQuery.isError,
    eventFilters,
    setEventFilters,
    groups: groupsQuery.data ?? [],
    approveMutation,
    rejectMutation,
    refresh: invalidateAll,
  };
}
