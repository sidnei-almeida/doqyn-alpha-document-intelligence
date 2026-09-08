/**
 * A frase que a pessoa lê quando uma chamada de API falha.
 *
 * O mapa que morava aqui — 45 frases escritas à mão, código a código — foi para
 * `src/i18n/catalog/pt-BR/errors.json`, junto com as outras 228 extraídas das chamadas de
 * `ServiceError` do servidor. Não era um mapa pior que o catálogo; era o mesmo mapa em um
 * lugar onde só o português cabia. As frases são exatamente aquelas, palavra por palavra.
 *
 * O que sobrou aqui é a lógica que um catálogo não expressa: quais códigos preferem a mensagem
 * do servidor, qual erro carrega um motivo digitado por outra pessoa, e que ação oferecer.
 */
import { i18n } from '@/i18n';

export type ApiErrorDetails = Record<string, unknown>;

/**
 * Códigos genéricos por construção, em que a mensagem do servidor é a informação.
 *
 * `VALIDATION_ERROR` cobre quinze frases diferentes — "E-mail inválido", "Papel inválido",
 * "Nome do membro é obrigatório" — e o código não distingue nenhuma delas. Para esses três a
 * frase do servidor vem primeiro e o catálogo é a rede: "Revise os campos informados e tente
 * novamente." é o que sobra quando o servidor não disse qual campo.
 *
 * Só `NOT_FOUND` não tem frase própria no catálogo — "não encontrado" sem dizer o quê não
 * informa nada. Os outros dois herdaram frases genéricas que já existiam e funcionam.
 *
 * São 45 pontos de chamada que deveriam ter código próprio. Dívida declarada, não solução —
 * `npm run i18n:check` conta quantos são, para que o número não cresça em silêncio.
 */
const PASSTHROUGH_CODES = new Set(['VALIDATION_ERROR', 'NOT_FOUND', 'FORBIDDEN']);

function catalogPhrase(code: string): string | null {
  const key = `errors:${code}`;
  return i18n.exists(key) ? i18n.t(key) : null;
}

export function getFriendlyAuthErrorMessage(
  code: string,
  fallbackMessage?: string,
  details?: ApiErrorDetails,
): string {
  /* Motivo de rejeição é texto escrito por um administrador sobre este caso específico.
     Nenhum catálogo o contém, e substituí-lo por uma frase genérica apagaria a única
     explicação que a pessoa tem. */
  if (code === 'MEMBERSHIP_REJECTED' && typeof details?.rejectionReason === 'string') {
    const reason = details.rejectionReason.trim();
    if (reason) {
      return i18n.t('errors:MEMBERSHIP_REJECTED_WITH_REASON', { reason });
    }
  }

  const phrase = catalogPhrase(code);
  const server = fallbackMessage?.trim();

  if (PASSTHROUGH_CODES.has(code)) {
    return server || phrase || i18n.t('common:state.error');
  }

  return phrase ?? server ?? i18n.t('common:state.error');
}

export function getAuthErrorActions(code: string): Array<{ label: string; href: string }> {
  switch (code) {
    case 'NO_ACTIVE_MEMBERSHIP':
      // `/acesso` apresenta os caminhos que a pessoa percorre sozinha, inclusive a conta
      // pessoal. Entrar numa empresa que já existe não está lá: depende de convite.
      return [{ label: 'Ver formas de acesso', href: '/acesso' }];
    case 'EMAIL_NOT_VERIFIED':
      return [{ label: 'Confirmar e-mail', href: '/confirmar-cadastro' }];
    case 'MEMBERSHIP_REJECTED':
    case 'MEMBERSHIP_REMOVED':
      // Sem ação: voltar depende de um convite novo, que sai das mãos de quem administra a
      // empresa. Um botão aqui levaria a uma tela onde a pessoa não resolve nada.
      return [];
    default:
      return [];
  }
}
