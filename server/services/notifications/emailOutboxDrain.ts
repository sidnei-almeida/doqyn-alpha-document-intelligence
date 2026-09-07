import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb } from '../../db/mongoClient.js';
import type { MongoNotification, MongoNotificationDelivery } from '../../db/types.js';
import {
  EMAIL_MAX_ATTEMPTS,
  EMAIL_MAX_PER_USER_PER_HOUR,
  emailRetryDelayMinutes,
  isEmailChannelEnabled,
} from '../../config/emailConfig.js';
import { resolvePublicAppBaseUrl } from '../../config/publicUrlConfig.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { logger } from '../../utils/logger.js';
import { buildNotificationEmail } from './emailTemplate.js';
import { sendEmailViaResend } from './providers/resendEmailProvider.js';

/**
 * O outbox de e-mail, drenado do banco — não de uma fila em memória.
 *
 * A linha em `notification_deliveries` já é gravada quando a notificação nasce, e é ela que manda:
 * o processo pode morrer no meio que o aviso continua lá, esperando. Uma fila em memória perderia
 * o que estivesse voando; o Redis resolveria isso, mas amarraria o e-mail a mais uma peça de pé,
 * e aviso perdido é o tipo de falha que ninguém percebe até alguém reclamar que não recebeu.
 *
 * **Não roda enquanto o canal está desligado.** Sem `NOTIFICATION_EMAIL_PROVIDER`, nenhuma linha
 * nasce `queued` — o drenador nem é iniciado.
 */
const BATCH_SIZE = 20;

/** Linha presa em `sending` há mais que isto teve o processo derrubado no meio. */
const LOCK_EXPIRA_MS = 5 * 60_000;

type DeliveryRow = MongoNotificationDelivery & {
  attempts?: number;
  nextAttemptAt?: Date | null;
  lockedAt?: Date | null;
  providerMessageId?: string | null;
};

async function collections() {
  const db = await getDb();
  return {
    deliveries: db.collection<DeliveryRow>(SHARED_APP_COLLECTIONS.notificationDeliveries),
    notifications: db.collection<MongoNotification>(SHARED_APP_COLLECTIONS.notifications),
  };
}

/**
 * O endereço de quem recebe, do cadastro do tenant.
 *
 * Cache por tenant dentro da rodada: um lote de vinte avisos costuma ser da mesma empresa, e
 * perguntar vinte vezes a mesma lista seria pagar vinte vezes pela mesma resposta.
 */
async function buildEmailLookup(tenantIds: string[]): Promise<Map<string, string>> {
  const porUsuario = new Map<string, string>();
  for (const tenantId of new Set(tenantIds)) {
    const membros = await listOperationalTenantMembers(tenantId);
    for (const membro of membros) {
      const email = membro.email?.trim();
      // `authUserId` é o id que a notificação guarda; `memberId` é da associação, e não serve aqui.
      const userId = membro.authUserId?.trim();
      if (email && userId) porUsuario.set(`${tenantId}:${userId}`, email);
    }
  }
  return porUsuario;
}

/**
 * Uma passada pelo outbox. Devolve o que aconteceu, para quem chama poder registrar.
 *
 * Cada linha é travada por `findOneAndUpdate` antes do envio: duas instâncias da API drenando ao
 * mesmo tempo não mandam o mesmo aviso duas vezes. A trava vence sozinha, senão um processo morto
 * no instante errado prenderia aquele aviso para sempre.
 */
export async function drainEmailOutbox(): Promise<{
  sent: number;
  failed: number;
  retried: number;
  throttled: number;
}> {
  if (!isEmailChannelEnabled()) return { sent: 0, failed: 0, retried: 0, throttled: 0 };

  const { deliveries, notifications } = await collections();
  const agora = new Date();
  const limiteTrava = new Date(agora.getTime() - LOCK_EXPIRA_MS);

  const pendentes = await deliveries
    .find({
      channel: 'email',
      $or: [
        { status: 'queued', $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: agora } }] },
        // Preso em `sending` além da trava: o dono anterior não existe mais.
        { status: 'sending', lockedAt: { $lte: limiteTrava } },
      ],
    } as Record<string, unknown>)
    .limit(BATCH_SIZE)
    .toArray();

  if (pendentes.length === 0) return { sent: 0, failed: 0, retried: 0, throttled: 0 };

  const emails = await buildEmailLookup(pendentes.map((linha) => linha.tenantId));
  const baseUrl = resolvePublicAppBaseUrl();
  let sent = 0;
  let failed = 0;
  let retried = 0;
  let throttled = 0;

  /**
   * Quantos e-mails cada pessoa já recebeu na última hora.
   *
   * Contado uma vez por rodada, do próprio outbox — quem entregou é a fonte, não um contador em
   * memória que zera a cada reinício.
   */
  const desdeUmaHora = new Date(agora.getTime() - 60 * 60_000);
  const enviadosPorUsuario = new Map<string, number>();
  for (const userId of new Set(pendentes.map((linha) => linha.userId))) {
    const total = await deliveries.countDocuments({
      channel: 'email',
      userId,
      status: 'delivered',
      deliveredAt: { $gte: desdeUmaHora },
    } as Record<string, unknown>);
    enviadosPorUsuario.set(userId, total);
  }

  for (const linha of pendentes) {
    const jaEnviados = enviadosPorUsuario.get(linha.userId) ?? 0;
    if (jaEnviados >= EMAIL_MAX_PER_USER_PER_HOUR) {
      // Adiado, não descartado: o aviso continua verdadeiro na próxima janela.
      await deliveries.updateOne({ _id: linha._id } as Record<string, unknown>, {
        $set: {
          nextAttemptAt: new Date(agora.getTime() + 15 * 60_000),
          reason: 'Teto de e-mails por hora atingido para este destinatário.',
        },
      });
      throttled += 1;
      continue;
    }

    const travada = await deliveries.findOneAndUpdate(
      { _id: linha._id, status: linha.status } as Record<string, unknown>,
      { $set: { status: 'sending', lockedAt: agora } },
      { returnDocument: 'after' },
    );
    // Outra instância pegou primeiro: seguir em frente é o certo, não competir.
    if (!travada) continue;

    const destino = emails.get(`${linha.tenantId}:${linha.userId}`);
    if (!destino) {
      // Quem saiu do tenant não tem para onde receber, e isso não melhora com nova tentativa.
      await deliveries.updateOne({ _id: linha._id } as Record<string, unknown>, {
        $set: {
          status: 'failed',
          reason: 'Destinatário sem e-mail ativo no tenant.',
          lockedAt: null,
        },
      });
      failed += 1;
      continue;
    }

    const notificacao = await notifications.findOne({ _id: linha.notificationId } as Record<
      string,
      unknown
    >);
    if (!notificacao) {
      await deliveries.updateOne({ _id: linha._id } as Record<string, unknown>, {
        $set: {
          status: 'failed',
          reason: 'Notificação de origem não existe mais.',
          lockedAt: null,
        },
      });
      failed += 1;
      continue;
    }

    const { subject, html, text } = buildNotificationEmail(notificacao, baseUrl);
    const resultado = await sendEmailViaResend({
      to: destino,
      subject,
      html,
      text,
      // O id da entrega é único e estável: é a chave natural contra e-mail duplicado.
      idempotencyKey: linha._id,
    });

    if (resultado.ok) {
      await deliveries.updateOne({ _id: linha._id } as Record<string, unknown>, {
        $set: {
          status: 'delivered',
          deliveredAt: new Date(),
          providerMessageId: resultado.providerMessageId,
          reason: undefined,
          lockedAt: null,
        },
      });
      sent += 1;
      enviadosPorUsuario.set(linha.userId, (enviadosPorUsuario.get(linha.userId) ?? 0) + 1);
      continue;
    }

    const tentativas = (linha.attempts ?? 0) + 1;
    const desiste = !resultado.retryable || tentativas >= EMAIL_MAX_ATTEMPTS;

    await deliveries.updateOne({ _id: linha._id } as Record<string, unknown>, {
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
    logger.info('outbox de e-mail drenado', { sent, failed, retried, throttled });
  }

  return { sent, failed, retried, throttled };
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Liga o drenador — e não faz nada quando o canal está desligado.
 *
 * Intervalo, e não gatilho no momento em que a notificação nasce: emitir aviso não pode esperar
 * envio de e-mail, e uma passada a cada meio minuto é imperceptível para quem recebe e barata para
 * quem serve.
 */
export function startEmailOutboxDrain(intervalMs = 30_000): void {
  if (timer || !isEmailChannelEnabled()) return;

  logger.info('drenador de e-mail iniciado', { intervalMs });
  timer = setInterval(() => {
    void drainEmailOutbox().catch((error) => {
      // Falha aqui não derruba o processo: o aviso continua no outbox, e a próxima passada tenta.
      logger.error('falha ao drenar outbox de e-mail', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, intervalMs);

  // Não segura o processo de pé: quem manda no ciclo de vida é o servidor, não o drenador.
  timer.unref?.();
}

export function stopEmailOutboxDrain(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
