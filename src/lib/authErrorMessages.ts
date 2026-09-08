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
import { i18n, initI18n } from '@/i18n';
import ptErrors from '@/i18n/catalog/pt-BR/errors.json';

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

/** Última rede, quando nem o código nem o servidor disseram nada. */
const GENERIC_FAILURE = 'Não foi possível concluir a ação agora. Tente novamente.';

/**
 * Garante que o i18n existe antes de perguntar ao catálogo.
 *
 * Quem monta a árvore React chama `initI18n` pelo provider, mas esta função também é chamada de
 * fora dele — de um teste, de um script, de um `catch` que roda antes do primeiro render. Numa
 * instância não inicializada, `i18n.exists` devolve `false` para tudo, e toda mensagem de erro
 * virava a frase genérica. `initI18n` é idempotente, então chamar aqui não custa nada.
 */
const FALLBACK_ERRORS = ptErrors as Record<string, string>;

/**
 * A frase do catálogo, com o `pt-BR` embutido como rede.
 *
 * O caminho normal é o i18next, que resolve no idioma ativo. Mas ele não está disponível em
 * todo lugar de onde esta função é chamada: um teste em Node, um script, ou um `catch` que
 * dispara antes do primeiro render encontram a instância ainda não inicializada — e, com um
 * backend registrado, a inicialização do i18next é adiada para o próximo tick, então `t()`
 * chamado cedo demais devolve `undefined`.
 *
 * Ler o JSON embutido nesse caso não é duplicação: é o mesmo arquivo que o i18next carrega
 * como recurso estático. O que muda é só não depender do momento.
 */
function catalogPhrase(code: string): string | null {
  initI18n();
  const key = `errors:${code}`;
  if (i18n.isInitialized && i18n.exists(key)) {
    const phrase = i18n.t(key);
    if (typeof phrase === 'string' && phrase !== key) return phrase;
  }
  return FALLBACK_ERRORS[code] ?? null;
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
    return server || phrase || GENERIC_FAILURE;
  }

  return phrase ?? server ?? GENERIC_FAILURE;
}

/**
 * As duas ações moram em `common`, e não em `auth`.
 *
 * O banner de erro de sessão aparece em qualquer tela, inclusive antes de o catálogo `auth` ter
 * sido pedido — e `common` é o único que já vem no bundle. Um rótulo de botão que às vezes sai
 * como chave crua seria pior do que qualquer economia de bytes.
 */
export function getAuthErrorActions(code: string): Array<{ label: string; href: string }> {
  initI18n();

  switch (code) {
    case 'NO_ACTIVE_MEMBERSHIP':
      // `/acesso` apresenta os caminhos que a pessoa percorre sozinha, inclusive a conta
      // pessoal. Entrar numa empresa que já existe não está lá: depende de convite.
      return [{ label: i18n.t('common:authErrorAction.verFormasDeAcesso'), href: '/acesso' }];
    case 'EMAIL_NOT_VERIFIED':
      return [
        { label: i18n.t('common:authErrorAction.confirmarEmail'), href: '/confirmar-cadastro' },
      ];
    case 'MEMBERSHIP_REJECTED':
    case 'MEMBERSHIP_REMOVED':
      // Sem ação: voltar depende de um convite novo, que sai das mãos de quem administra a
      // empresa. Um botão aqui levaria a uma tela onde a pessoa não resolve nada.
      return [];
    default:
      return [];
  }
}
