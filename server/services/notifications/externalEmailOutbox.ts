import { randomUUID } from 'node:crypto';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoExternalEmailOutboxRow } from '../../db/types.js';
import {
  EMAIL_MAX_ATTEMPTS,
  EXTERNAL_EMAIL_MAX_PER_RECIPIENT_PER_HOUR,
  emailRetryDelayMinutes,
  isEmailChannelEnabled,
} from '../../config/emailConfig.js';
import { maskEmail } from '../../utils/maskSensitiveData.js';
import { logger } from '../../utils/logger.js';
import { sendEmailViaResend } from './providers/resendEmailProvider.js';

/**
 * O outbox de e-mail para quem não tem conta no DOQYN.
 *
 * Irmão do outbox de notificação por e-mail (`emailOutboxDrain.ts`), e não uma extensão dele: não
 * há `userId`, tenant membership, nem preferência por trás de um convidado externo — só um endereço
 * que alguém digitou num formulário e um e-mail já pronto para sair. Reaproveita a mesma trava por
 * `findOneAndUpdate`, o mesmo backoff, e um teto por hora **por endereço**, e não por usuário —
 * porque o endereço em si é a única coisa que este canal conhece sobre o destinatário.
 */
const BATCH_SIZE = 20;

/** Linha presa em `sending` há mais que isto teve o processo derrubado no meio. */
const LOCK_EXPIRA_MS = 5 * 60_000;

async function collection() {
  const db = await getDb();
  return db.collection<MongoExternalEmailOutboxRow>(SHARED_APP_COLLECTIONS.externalEmailOutbox);
}

export type EnqueueExternalEmailInput = {
  tenantId: string;
  kind: MongoExternalEmailOutboxRow['kind'];
  /** O fato que produziu este e-mail — retentar a mesma criação não enfileira um segundo. */
  dedupeKey: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Enfileira um e-mail externo. Nunca lança — a ação que originou o convite (compartilhar, pedir
 * assinatura) já terminou, e uma falha ao avisar não pode desfazer o que já aconteceu.
 */
export async function enqueueExternalEmail(
  input: EnqueueExternalEmailInput,
): Promise<{ enqueued: boolean }> {
  try {
    if (!isMongoNativeConfigured()) return { enqueued: false };

    const col = await collection();
    const now = new Date();
    const row: MongoExternalEmailOutboxRow = {
      _id: `extmail_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      tenantId: input.tenantId,
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
      status: isEmailChannelEnabled() ? 'queued' : 'skipped_no_provider',
      createdAt: now,
    };

    await col.insertOne(row);
    return { enqueued: true };
  } catch (error) {
    // Chave duplicada: o mesmo fato já tinha posto um e-mail na fila — não é erro, é o que a chave
    // existe para fazer.
    if ((error as { code?: number } | null)?.code === 11000) {
      logger.info('e-mail externo já estava na fila', {
        recipientEmail: maskEmail(input.recipientEmail),
        dedupeKey: input.dedupeKey,
      });
      return { enqueued: false };
    }
    logger.warn('falha ao enfileirar e-mail externo', {
      recipientEmail: maskEmail(input.recipientEmail),
      kind: input.kind,
      error: error instanceof Error ? error.message : String(error),
    });
    return { enqueued: false };
  }
}

/**
 * Uma passada pelo outbox externo. Mesma trava do canal de membro, mesmo backoff — o que muda é a
 * chave do teto por hora: `recipientEmail`, porque este canal não tem `userId`.
 */
export async function drainExternalEmailOutbox(): Promise<{
  sent: number;
  failed: number;
  retried: number;
  throttled: number;
}> {
  if (!isEmailChannelEnabled()) return { sent: 0, failed: 0, retried: 0, throttled: 0 };

  const col = await collection();
  const agora = new Date();
  const limiteTrava = new Date(agora.getTime() - LOCK_EXPIRA_MS);

  const pendentes = await col
    .find({
      $or: [
        { status: 'queued', $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: agora } }] },
        // Preso em `sending` além da trava: o dono anterior não existe mais.
        { status: 'sending', lockedAt: { $lte: limiteTrava } },
      ],
    } as Record<string, unknown>)
    .limit(BATCH_SIZE)
    .toArray();

  if (pendentes.length === 0) return { sent: 0, failed: 0, retried: 0, throttled: 0 };

  let sent = 0;
  let failed = 0;
  let retried = 0;
  let throttled = 0;

  const contarEnviadosNaUltimaHora = async (recipientEmail: string): Promise<number> =>
    col.countDocuments({
      recipientEmail,
      status: 'delivered',
      deliveredAt: { $gte: new Date(Date.now() - 60 * 60_000) },
    } as Record<string, unknown>);

  for (const linha of pendentes) {
    const travada = await col.findOneAndUpdate(
      { _id: linha._id, status: linha.status } as Record<string, unknown>,
      { $set: { status: 'sending', lockedAt: agora } },
      { returnDocument: 'after' },
    );
    // Outra instância pegou primeiro: seguir em frente é o certo, não competir.
    if (!travada) continue;

    if (
      (await contarEnviadosNaUltimaHora(linha.recipientEmail)) >=
      EXTERNAL_EMAIL_MAX_PER_RECIPIENT_PER_HOUR
    ) {
      // Adiado, não descartado: o convite continua verdadeiro na próxima janela.
      await col.updateOne({ _id: linha._id } as Record<string, unknown>, {
        $set: {
          status: 'queued',
          lockedAt: null,
          nextAttemptAt: new Date(agora.getTime() + 15 * 60_000),
          reason: 'Teto de e-mails por hora atingido para este destinatário.',
        },
      });
      throttled += 1;
      continue;
    }

    const resultado = await sendEmailViaResend({
      to: linha.recipientEmail,
      subject: linha.subject,
      html: linha.html,
      text: linha.text,
      // O id da linha é único e estável: é a chave natural contra e-mail duplicado.
      idempotencyKey: linha._id,
    });

    if (resultado.ok) {
      await col.updateOne({ _id: linha._id } as Record<string, unknown>, {
        $set: {
          status: 'delivered',
          deliveredAt: new Date(),
          providerMessageId: resultado.providerMessageId,
          reason: undefined,
          lockedAt: null,
        },
      });
      sent += 1;
      continue;
    }

    const tentativas = (linha.attempts ?? 0) + 1;
    const desiste = !resultado.retryable || tentativas >= EMAIL_MAX_ATTEMPTS;

    await col.updateOne({ _id: linha._id } as Record<string, unknown>, {
      $set: {
        status: desiste ? 'failed' : 'queued',
        reason: resultado.reason,
        attempts: tentativas,
        lockedAt: null,
        nextAttemptAt: desiste
          ? null
          : new Date(Date.now() + emailRetryDelayMinutes(tentativas) * 60_000),
      },
    });

    if (desiste) failed += 1;
    else retried += 1;
  }

  if (sent || failed || retried || throttled) {
    logger.info('outbox de e-mail externo drenado', { sent, failed, retried, throttled });
  }

  return { sent, failed, retried, throttled };
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Liga o drenador externo — próprio timer, independente do canal de membro. */
export function startExternalEmailOutboxDrain(intervalMs = 30_000): void {
  if (timer || !isEmailChannelEnabled()) return;

  logger.info('drenador de e-mail externo iniciado', { intervalMs });
  timer = setInterval(() => {
    void drainExternalEmailOutbox().catch((error) => {
      // Falha aqui não derruba o processo: a linha continua no outbox, e a próxima passada tenta.
      logger.error('falha ao drenar outbox de e-mail externo', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, intervalMs);

  // Não segura o processo de pé: quem manda no ciclo de vida é o servidor, não o drenador.
  timer.unref?.();
}

export function stopExternalEmailOutboxDrain(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
