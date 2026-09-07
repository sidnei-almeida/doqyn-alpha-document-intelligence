import { randomUUID } from 'node:crypto';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb } from '../../db/mongoClient.js';
import type { NotificationChannel } from '../../db/notificationTypes.js';
import type { MongoNotification, MongoNotificationDelivery } from '../../db/types.js';
import { logger } from '../../utils/logger.js';
import { channelsForNotification } from './notificationPreferences.js';

async function getDeliveriesCollection() {
  const db = await getDb();
  return db.collection<MongoNotificationDelivery>(SHARED_APP_COLLECTIONS.notificationDeliveries);
}

/**
 * Se existe provedor configurado para o canal.
 *
 * Hoje só `in_app` responde sim. As duas variáveis são o ponto de entrada da fase 2 — quando
 * houver conta de SMTP ou Meta API, definir a variável passa a produzir linhas `queued` em vez de
 * `skipped_no_provider`, sem tocar em quem emite.
 */
export function isChannelProviderConfigured(channel: NotificationChannel): boolean {
  if (channel === 'in_app') return true;
  if (channel === 'email') return Boolean(process.env.NOTIFICATION_EMAIL_PROVIDER);
  return Boolean(process.env.NOTIFICATION_WHATSAPP_PROVIDER);
}

/**
 * Grava a intenção de entrega de uma notificação, um registro por canal.
 *
 * Falha aqui não derruba a emissão: a notificação já está na caixa do usuário, e perder o registro
 * de outbox é menos grave que perder o aviso. O erro é logado para não sumir calado.
 */
export async function recordNotificationDeliveries(
  notifications: MongoNotification[],
  channelsByUserId: Map<string, NotificationChannel[]>,
): Promise<void> {
  if (notifications.length === 0) return;

  const now = new Date();
  const rows: MongoNotificationDelivery[] = [];

  for (const notification of notifications) {
    // Os canais vêm por usuário, decididos antes de a notificação existir; o degrau de vencimento
    // é de cada aviso, e só aqui os dois se encontram.
    const channels = channelsForNotification(
      channelsByUserId.get(notification.userId) ?? ['in_app'],
      notification,
    );
    for (const channel of channels) {
      const configured = isChannelProviderConfigured(channel);
      rows.push({
        _id: `notdlv_${randomUUID()}`,
        tenantId: notification.tenantId,
        notificationId: notification._id,
        userId: notification.userId,
        channel,
        status: configured
          ? channel === 'in_app'
            ? 'delivered'
            : 'queued'
          : 'skipped_no_provider',
        reason: configured ? undefined : 'Nenhum provedor configurado para este canal.',
        createdAt: now,
        deliveredAt: channel === 'in_app' ? now : null,
      });
    }
  }

  if (rows.length === 0) return;

  try {
    const deliveries = await getDeliveriesCollection();
    await deliveries.insertMany(rows, { ordered: false });
  } catch (error) {
    logger.warn('notification deliveries not recorded', {
      error: error instanceof Error ? error.message : String(error),
      notifications: notifications.length,
    });
  }
}
