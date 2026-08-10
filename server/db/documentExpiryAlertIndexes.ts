import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const DOCUMENT_EXPIRY_ALERT_INDEXES: IndexDescription[] = [
  // Impede alerta duplicado do mesmo marco: a avaliação diária é idempotente, então pode rodar
  // duas vezes no mesmo dia ou ser reprocessada sem incomodar o usuário de novo.
  {
    key: { documentId: 1, userId: 1, offsetDays: 1 },
    unique: true,
    name: 'document_user_offset_unique',
  },
  // Caixa de alertas do usuário, o acesso mais quente.
  { key: { tenantId: 1, userId: 1, status: 1, createdAt: -1 } },
  { key: { tenantId: 1, userId: 1, createdAt: -1 } },
  // Limpeza quando o documento é excluído ou tem o vencimento corrigido.
  { key: { tenantId: 1, documentId: 1 } },
];

export async function ensureDocumentExpiryAlertIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentExpiryAlerts,
    DOCUMENT_EXPIRY_ALERT_INDEXES,
  );
}
