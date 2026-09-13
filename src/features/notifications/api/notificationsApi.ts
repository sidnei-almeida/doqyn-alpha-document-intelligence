import { authFetch } from '@/auth/apiAuth';
import { parseApiError } from '@/lib/apiErrors';

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
  | 'access_rejected'
  | 'document_requested'
  | 'document_request_fulfilled'
  | 'inbound_share_received'
  | 'inbound_share_accepted'
  | 'inbound_share_declined'
  | 'member_joined';

export type AppNotification = {
  id: string;
  type: NotificationType;
  /** Texto gravado — o que se mostra quando a notificação não tem `params`. */
  title: string;
  body?: string;
  params?: Record<string, string | number | boolean>;
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
  /* Mantém o nome local, mas devolve `ApiError`: o `code` sobrevive até a tela,
     que é quem sabe traduzi-lo. */
  return parseApiError(response);
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
