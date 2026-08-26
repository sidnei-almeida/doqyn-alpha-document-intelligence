import { authFetch } from '@/auth/apiAuth';

export type NotificationStatus = 'unread' | 'read' | 'dismissed';

export type NotificationType =
  | 'document_expiring'
  | 'document_created'
  | 'document_updated'
  | 'signature_required'
  | 'document_shared'
  | 'approval_requested'
  | 'approval_decided'
  | 'access_approved'
  | 'access_rejected';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  documentId?: string;
  documentName?: string;
  categoryName?: string;
  actorName?: string;
  /** Só em `document_expiring`. */
  expiry?: {
    offsetDays: number;
    validityDate: string;
    daysRemaining: number;
  };
  status: NotificationStatus;
  createdAt: string;
};

export type NotificationsResponse = {
  items: AppNotification[];
  unreadCount: number;
};

async function parseError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return new Error(body?.message ?? `HTTP ${response.status}`);
}

export async function listNotifications(params?: {
  status?: NotificationStatus;
  limit?: number;
}): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await authFetch(`/api/notifications${suffix}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as NotificationsResponse;
}

export async function updateNotification(
  notificationId: string,
  status: 'read' | 'dismissed',
): Promise<{ notification: AppNotification }> {
  const response = await authFetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as { notification: AppNotification };
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const response = await authFetch('/api/notifications', { method: 'POST' });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as { updated: number };
}
