import { resolveEmailProviderConfig } from '../../../config/emailConfig.js';
import { logger } from '../../../utils/logger.js';

/**
 * Envio pelo Resend, por HTTP puro.
 *
 * Sem SDK de propósito: o que usamos é um POST com três campos, e uma dependência a mais para isso
 * seria mais superfície para atualizar do que código economizado. A resposta traz o id da mensagem,
 * que é o que permite rastrear a entrega depois no painel deles.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Versão em texto puro: cliente que não renderiza HTML, e leitor de tela, leem esta. */
  text: string;
  /**
   * Chave de idempotência — o mesmo id de entrega nunca manda dois e-mails.
   *
   * O drenador pode reprocessar uma linha se o processo cair entre o envio e a gravação do
   * resultado. Sem esta chave, a pessoa receberia o aviso duas vezes.
   */
  idempotencyKey: string;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string }
  /** `retryable` separa "tente de novo" de "não adianta": endereço inválido não melhora com espera. */
  | { ok: false; reason: string; retryable: boolean };

export async function sendEmailViaResend(message: EmailMessage): Promise<EmailSendResult> {
  const config = resolveEmailProviderConfig();
  if (!config) {
    return { ok: false, reason: 'Canal de e-mail desligado.', retryable: false };
  }

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
    });
  } catch (error) {
    // Rede caiu, DNS falhou, timeout: nada disso é culpa do destinatário — vale tentar de novo.
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Falha de rede ao falar com o Resend.',
      retryable: true,
    };
  }

  const corpo = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (response.ok && corpo.id) {
    return { ok: true, providerMessageId: corpo.id };
  }

  /**
   * 4xx é recusa: chave errada, remetente fora do domínio verificado, endereço inválido. Repetir
   * só gastaria cota. 429 é a exceção — é pedido para desacelerar, não recusa.
   */
  const retryable = response.status === 429 || response.status >= 500;
  const reason = corpo.message ?? corpo.name ?? `HTTP ${response.status}`;

  logger.warn('resend email rejeitado', {
    status: response.status,
    retryable,
    reason,
  });

  return { ok: false, reason, retryable };
}
