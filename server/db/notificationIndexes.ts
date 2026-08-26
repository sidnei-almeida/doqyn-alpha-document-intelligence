import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const NOTIFICATION_INDEXES: IndexDescription[] = [
  // Um fato, uma notificação por pessoa. Emissão reprocessada — retry de job, dois cliques no
  // mesmo confirm — não pode encher a caixa do usuário com o mesmo aviso.
  {
    key: { tenantId: 1, userId: 1, type: 1, eventKey: 1 },
    unique: true,
    name: 'tenant_user_type_event_unique',
  },
  // Caixa do usuário, o acesso mais quente: sino e página filtram por status e ordenam por data.
  { key: { tenantId: 1, userId: 1, status: 1, createdAt: -1 } },
  { key: { tenantId: 1, userId: 1, createdAt: -1 } },
  // Limpeza quando o documento é excluído ou tem o vencimento corrigido.
  { key: { tenantId: 1, documentId: 1 } },
];

export const NOTIFICATION_DELIVERY_INDEXES: IndexDescription[] = [
  // Uma linha por (notificação, canal): reemitir não duplica o registro de entrega.
  {
    key: { notificationId: 1, channel: 1 },
    unique: true,
    name: 'notification_channel_unique',
  },
  // A fila que um provedor futuro drena: o que ficou parado, mais antigo primeiro.
  { key: { tenantId: 1, status: 1, channel: 1, createdAt: 1 } },
];

export async function ensureNotificationIndexes() {
  await ensureIndexesForCollection(SHARED_APP_COLLECTIONS.notifications, NOTIFICATION_INDEXES);
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.notificationDeliveries,
    NOTIFICATION_DELIVERY_INDEXES,
  );
}
