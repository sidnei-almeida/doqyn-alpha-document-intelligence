import { randomUUID } from 'node:crypto';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../db/notificationTypes.js';
import type { MongoNotification } from '../../db/types.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { logger } from '../../utils/logger.js';
import { recordNotificationDeliveries } from './notificationDelivery.js';
import {
  channelsForMember,
  loadNotificationPreferences,
  wantsNotification,
} from './notificationPreferences.js';

/**
 * `documentos × destinatários` cresce rápido — 500 documentos e um grupo de 40 pessoas dão 20.000
 * registros. Gravar em lotes limitados evita o pico de memória dentro do processo da API.
 */
const INSERT_BATCH_SIZE = 500;

async function getNotificationsCollection() {
  const db = await getDb();
  return db.collection<MongoNotification>(SHARED_APP_COLLECTIONS.notifications);
}

export type EmitNotificationInput = {
  tenantId: string;
  companyId?: string;
  type: NotificationType;
  /** Destinatários por `userId` do auth. Já resolvidos — ver `notificationRecipients.ts`. */
  recipients: Iterable<string>;
  /** Identidade do fato dentro do tipo. Ver `MongoNotification.eventKey`. */
  eventKey: string;
  title: string;
  body?: string;
  documentId?: string;
  documentName?: string;
  categoryId?: string;
  categoryName?: string;
  actorUserId?: string;
  actorName?: string;
  expiry?: MongoNotification['expiry'];
};

export type EmitNotificationResult = {
  created: number;
  skippedByPreference: number;
};

/**
 * Só erro de escrita em lote pode ser tratado como duplicata. Sem esta checagem, um
 * `MongoNetworkError` — que não traz `writeErrors` — passaria pelo mesmo caminho e a emissão
 * registraria N criados tendo gravado zero.
 */
function isBulkWriteError(
  error: unknown,
): error is { writeErrors: Array<{ code?: number; index?: number }> } {
  return Array.isArray((error as { writeErrors?: unknown }).writeErrors);
}

/**
 * Entrega uma notificação a um conjunto de pessoas.
 *
 * A ordem importa: destinatário primeiro (quem alcança o documento), preferência depois (quem quis
 * saber), canal por último (por onde daria para avisar). Emitir sem o filtro de preferência era o
 * que a tela de Editar acesso prometia e o servidor nunca cumpriu — o campo era gravado e nunca
 * lido.
 *
 * Reprocessar é seguro: a chave única (tenant, usuário, tipo, `eventKey`) absorve a segunda
 * tentativa, e só as linhas de fato inseridas geram registro de entrega.
 */
export async function emitNotifications(
  input: EmitNotificationInput,
): Promise<EmitNotificationResult> {
  const result: EmitNotificationResult = { created: 0, skippedByPreference: 0 };
  if (!isMongoNativeConfigured()) return result;

  const recipients = [...new Set(input.recipients)].filter(
    (userId) => userId && userId !== input.actorUserId,
  );
  if (recipients.length === 0) return result;

  const preferencesByUser = await loadNotificationPreferences(input.tenantId, recipients);
  const channelsByUserId = new Map<string, NotificationChannel[]>();
  const now = new Date();
  const pending: MongoNotification[] = [];

  for (const userId of recipients) {
    const preferences = preferencesByUser.get(userId);
    if (!preferences || !wantsNotification(preferences, input.type)) {
      result.skippedByPreference += 1;
      continue;
    }

    channelsByUserId.set(userId, channelsForMember(preferences));
    pending.push({
      _id: `notif_${randomUUID()}`,
      tenantId: input.tenantId,
      companyId: input.companyId ?? input.tenantId,
      type: input.type,
      userId,
      eventKey: input.eventKey,
      title: input.title,
      body: input.body,
      documentId: input.documentId,
      documentName: input.documentName,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      expiry: input.expiry,
      status: 'unread',
      createdAt: now,
      readAt: null,
    });
  }

  if (pending.length === 0) return result;

  result.created = await persistNotifications(pending, channelsByUserId);

  logger.info('notifications emitted', {
    tenantId: input.tenantId,
    type: input.type,
    created: result.created,
    skippedByPreference: result.skippedByPreference,
  });

  return result;
}

/**
 * Grava as notificações e o registro de entrega delas.
 *
 * Separado de `emitNotifications` porque a varredura de vencimento resolve destinatário e
 * preferência à sua maneira — por documento, num lote só — e precisa da mesma gravação sem
 * repetir a leitura de membros a cada documento.
 *
 * `ordered: false` mais tolerância a duplicate-key: a corrida entre duas execuções não é erro, é
 * exatamente o que o índice único existe para resolver. Só as linhas de fato inseridas geram
 * registro de entrega — `writeErrors[].index` diz quais ficaram de fora.
 */
export async function persistNotifications(
  pending: MongoNotification[],
  channelsByUserId: Map<string, NotificationChannel[]>,
): Promise<number> {
  if (pending.length === 0) return 0;

  const notifications = await getNotificationsCollection();
  const inserted: MongoNotification[] = [];

  for (let start = 0; start < pending.length; start += INSERT_BATCH_SIZE) {
    const batch = pending.slice(start, start + INSERT_BATCH_SIZE);

    try {
      await notifications.insertMany(batch, { ordered: false });
      inserted.push(...batch);
    } catch (error) {
      if (!isBulkWriteError(error)) throw error;

      const duplicates = error.writeErrors.filter((writeError) => writeError.code === 11000);
      if (duplicates.length !== error.writeErrors.length) throw error;

      const failed = new Set(duplicates.map((writeError) => writeError.index));
      batch.forEach((row, index) => {
        if (!failed.has(index)) inserted.push(row);
      });
    }
  }

  await recordNotificationDeliveries(inserted, channelsByUserId);
  return inserted.length;
}

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  documentId?: string;
  documentName?: string;
  categoryName?: string;
  actorName?: string;
  expiry?: {
    offsetDays: number;
    validityDate: string;
    daysRemaining: number;
  };
  status: NotificationStatus;
  createdAt: string;
};

function serializeNotification(notification: MongoNotification): NotificationListItem {
  return {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    documentId: notification.documentId,
    documentName: notification.documentName,
    categoryName: notification.categoryName,
    actorName: notification.actorName,
    expiry: notification.expiry
      ? {
          offsetDays: notification.expiry.offsetDays,
          validityDate: new Date(notification.expiry.validityDate).toISOString(),
          daysRemaining: notification.expiry.daysRemaining,
        }
      : undefined,
    status: notification.status,
    createdAt: new Date(notification.createdAt).toISOString(),
  };
}

export async function listUserNotifications(input: {
  tenantId: string;
  userId: string;
  status?: NotificationStatus;
  limit?: number;
}): Promise<{ items: NotificationListItem[]; unreadCount: number }> {
  if (!isMongoNativeConfigured()) return { items: [], unreadCount: 0 };

  const notifications = await getNotificationsCollection();
  const query: Record<string, unknown> = { tenantId: input.tenantId, userId: input.userId };
  if (input.status) query.status = input.status;

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const [rows, unreadCount] = await Promise.all([
    notifications.find(query).sort({ createdAt: -1 }).limit(limit).toArray(),
    notifications.countDocuments({
      tenantId: input.tenantId,
      userId: input.userId,
      status: 'unread',
    }),
  ]);

  return { items: rows.map(serializeNotification), unreadCount };
}

export async function updateNotificationStatus(input: {
  tenantId: string;
  userId: string;
  notificationId: string;
  status: Extract<NotificationStatus, 'read' | 'dismissed'>;
}): Promise<NotificationListItem> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const notifications = await getNotificationsCollection();

  // `readAt` só é gravado quando a notificação foi de fato lida: dispensar sem abrir não pode
  // ficar registrado como leitura, senão qualquer relatório de "quando viu" mente.
  const patch: Record<string, unknown> =
    input.status === 'read' ? { status: 'read', readAt: new Date() } : { status: 'dismissed' };

  // O filtro carrega tenantId e userId: ninguém marca notificação de outra pessoa como lida.
  const updated = await notifications.findOneAndUpdate(
    { _id: input.notificationId, tenantId: input.tenantId, userId: input.userId },
    { $set: patch },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new ServiceError('Notificação não encontrada.', 'NOTIFICATION_NOT_FOUND', 404);
  }

  return serializeNotification(updated);
}

export async function markAllNotificationsRead(input: {
  tenantId: string;
  userId: string;
}): Promise<{ updated: number }> {
  if (!isMongoNativeConfigured()) return { updated: 0 };

  const notifications = await getNotificationsCollection();
  const result = await notifications.updateMany(
    { tenantId: input.tenantId, userId: input.userId, status: 'unread' },
    { $set: { status: 'read', readAt: new Date() } },
  );

  return { updated: result.modifiedCount };
}

/**
 * Descarta notificações de vencimento de um documento cuja data mudou.
 *
 * Sem isto, corrigir a validade à mão deixaria na caixa do usuário um aviso que já não vale — e a
 * chave única impediria o marco novo de ser gerado se coincidisse com o antigo. Só o vencimento é
 * apagado: "documento criado" continua verdade depois que a validade muda.
 */
export async function clearDocumentExpiryNotifications(input: {
  tenantId: string;
  documentId: string;
}): Promise<{ removed: number }> {
  if (!isMongoNativeConfigured()) return { removed: 0 };

  const notifications = await getNotificationsCollection();
  const result = await notifications.deleteMany({
    tenantId: input.tenantId,
    documentId: input.documentId,
    type: 'document_expiring',
  });

  return { removed: result.deletedCount };
}
