/**
 * Configuração do canal de e-mail — e o interruptor que o mantém desligado.
 *
 * `NOTIFICATION_EMAIL_PROVIDER` é a mesma variável que `notificationDelivery.ts` já consulta para
 * decidir entre `queued` e `skipped_no_provider`. Enquanto ela estiver vazia, nada muda: as
 * notificações continuam só na caixa do app, e o drenador nem chega a rodar.
 *
 * Ligar exige três coisas de fora do código — chave da conta, remetente e domínio verificado no
 * DNS. Sem qualquer uma delas o envio nasceria falhando, então a configuração é validada inteira
 * ou tratada como ausente.
 */
export type EmailProviderConfig = {
  provider: 'resend';
  apiKey: string;
  /** `DOQYN <avisos@mail.doqyn.com>` — o remetente precisa estar no domínio verificado. */
  from: string;
  /** Para onde vai a resposta de quem apertar "responder". Opcional. */
  replyTo?: string;
};

function readTrimmed(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function resolveEmailProviderConfig(): EmailProviderConfig | null {
  const provider = readTrimmed('NOTIFICATION_EMAIL_PROVIDER')?.toLowerCase();
  if (!provider) return null;

  if (provider !== 'resend') {
    // Nome desconhecido não é o mesmo que canal desligado: alguém quis ligar e escreveu errado.
    throw new Error(
      `NOTIFICATION_EMAIL_PROVIDER inválido: "${provider}". Hoje só "resend" é suportado.`,
    );
  }

  const apiKey = readTrimmed('RESEND_API_KEY');
  const from = readTrimmed('NOTIFICATION_EMAIL_FROM');

  if (!apiKey || !from) {
    throw new Error(
      'NOTIFICATION_EMAIL_PROVIDER está definido, mas RESEND_API_KEY ou NOTIFICATION_EMAIL_FROM faltam. ' +
        'Sem os três, o canal enviaria para o vazio — deixe o provedor vazio para manter o e-mail desligado.',
    );
  }

  return { provider: 'resend', apiKey, from, replyTo: readTrimmed('NOTIFICATION_EMAIL_REPLY_TO') };
}

export function isEmailChannelEnabled(): boolean {
  try {
    return resolveEmailProviderConfig() !== null;
  } catch {
    // Configuração pela metade é tratada como desligada para quem só pergunta; quem for enviar
    // recebe o erro com o motivo.
    return false;
  }
}

/** Quantas vezes uma entrega é tentada antes de virar `failed` de vez. */
export const EMAIL_MAX_ATTEMPTS = 4;

/** Espera entre tentativas, em minutos, por número de tentativas já feitas. */
export function emailRetryDelayMinutes(attempts: number): number {
  return [1, 5, 30, 120][Math.min(attempts, 3)];
}
