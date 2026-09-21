import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

const DIA = 24 * 60 * 60;

/**
 * Trinta dias, e não os 120 do canal de membro.
 *
 * A linha guarda e-mail e HTML renderizado de terceiro que nunca teve conta nem caixa de avisos —
 * quando o envio some, não sobra afterlife nenhum para justificar guardar PII de fora por quatro
 * meses.
 */
export const EXTERNAL_EMAIL_OUTBOX_TTL_SECONDS = 30 * DIA;

export const EXTERNAL_EMAIL_OUTBOX_INDEXES: IndexDescription[] = [
  // O fato que originou o envio, uma vez só: retry de criação não duplica o e-mail.
  { key: { dedupeKey: 1 }, unique: true },
  // A fila que o drenador varre — pendente, mais antigo primeiro.
  { key: { status: 1, nextAttemptAt: 1, createdAt: 1 } },
  // O teto por hora por destinatário é contado daqui.
  { key: { recipientEmail: 1, status: 1, deliveredAt: -1 } },
  { key: { tenantId: 1, createdAt: -1 } },
  {
    key: { createdAt: 1 },
    expireAfterSeconds: EXTERNAL_EMAIL_OUTBOX_TTL_SECONDS,
    name: 'external_email_outbox_ttl',
  },
];

export async function ensureExternalEmailOutboxIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.externalEmailOutbox,
    EXTERNAL_EMAIL_OUTBOX_INDEXES,
  );
}
