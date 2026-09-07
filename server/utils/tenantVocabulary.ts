/**
 * As palavras que mudam quando o tenant é pessoa física — espelho de `src/lib/tenantVocabulary.ts`.
 *
 * Vive separado do cliente de propósito: `server/` não importa de `src/`, e um termo compartilhado
 * em `shared/` para duas constantes de texto pesaria mais do que a duplicação. Se um terceiro
 * consumidor aparecer, aí sim vale mover.
 *
 * Só se ramifica mensagem que nasce com o tenant em mãos. Erro de sessão sem tenant resolvido
 * (`membershipAccessErrors`, `tenantContext`) não tem o que consultar, e ali o texto neutro é a
 * resposta certa, não um meio-termo.
 */
import type { TenantType } from '../db/types.js';

export type ServerTenantVocabulary = {
  /** O escopo que contém documentos: `empresa` · `conta`. */
  scope: string;
  /** Posse: `da empresa` · `da sua conta`. */
  ofScope: string;
  /** Saída do escopo: `para fora da empresa` · `para fora da sua conta`. */
  outsideScope: string;
};

const BUSINESS: ServerTenantVocabulary = {
  scope: 'empresa',
  ofScope: 'da empresa',
  outsideScope: 'para fora da empresa',
};

const INDIVIDUAL: ServerTenantVocabulary = {
  scope: 'conta',
  ofScope: 'da sua conta',
  outsideScope: 'para fora da sua conta',
};

export function tenantVocabulary(tenantType: TenantType | string | null | undefined) {
  return tenantType === 'individual' ? INDIVIDUAL : BUSINESS;
}
