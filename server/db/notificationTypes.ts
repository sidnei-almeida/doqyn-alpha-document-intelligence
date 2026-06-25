export type NotificationEventType =
  | 'DOCUMENT_CREATED'
  | 'DOCUMENT_UPDATED'
  | 'DOCUMENT_REQUIRES_SIGNATURE'
  | 'DOCUMENT_REQUIRES_REVIEW'
  | 'USER_ACCESS_APPROVED'
  | 'USER_ACCESS_REJECTED'
  | 'ACCESS_GROUP_DOCUMENT_AVAILABLE';

/** Planejado para worker futuro — não persistido nesta etapa. */
export type PlannedNotificationEvent = {
  tenantId: string;
  eventType: NotificationEventType;
  targetMemberIds: string[];
  channels: Array<'email' | 'whatsapp'>;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/** Planejado para worker futuro — não persistido nesta etapa. */
export type PlannedNotificationDelivery = {
  eventId: string;
  memberId: string;
  channel: 'email' | 'whatsapp';
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  createdAt: Date;
};
