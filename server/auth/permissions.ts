import type { AuthUser } from './types.js';
import { isDocumentAdmin } from '../tenancy/documentAccess.js';
import type { MongoDocument } from '../db/types.js';

/** Qualquer usuário autenticado pode solicitar análise experimental. */
export function canAnalyzeDocuments(user: AuthUser): boolean {
  return Boolean(user.id);
}

/**
 * Confirma metadados quem é `company_admin` ou dono do documento (D-09).
 *
 * O termo de propriedade é obrigatório: sem ele o usuário de tenant PF não confirmaria metadado
 * nenhum do próprio documento depois que `individual_admin` saiu do set de admin, porque PF não tem
 * `company_admin` nem regra de governança para compensar. Coerente com D-04 — o dono lê o próprio
 * documento, logo o dono decide sobre o metadado dele.
 */
export function canConfirmDocuments(
  user: AuthUser,
  doc?: Pick<MongoDocument, 'ownerUserId'>,
): boolean {
  if (isDocumentAdmin(user)) return true;

  const userId = user.id?.trim();
  return Boolean(userId && doc?.ownerUserId && doc.ownerUserId === userId);
}

function hasActiveMembership(user: AuthUser): boolean {
  const status = user.membershipStatus?.trim().toLowerCase();
  if (!status) return true;
  return status === 'active';
}

/**
 * Tracking documental — `company_admin` ou dono do documento em escopo (D-07).
 *
 * Decide só por `isDocumentAdmin`, e não por um segundo conjunto de papéis próprio de tracking:
 * dois conjuntos paralelos é justamente o que faz a regra divergir com o tempo. O fallback pelo
 * campo `role` (`admin`/`manager`) foi removido pelo mesmo motivo de D-03 — ele promovia dado
 * replicado no documento Mongo do membro a bypass, sem passar pela sessão verificada.
 *
 * Rotas de tracking do tenant inteiro, que não têm documento único em mãos, usam
 * `userGovernsTenantScope` em vez desta função, para que o tenant PF continue operando.
 */
export function canViewDocumentTracking(
  user: AuthUser,
  scope?: { ownerUserId?: string },
): boolean {
  const userId = user.id?.trim();
  if (!userId) return false;
  if (!hasActiveMembership(user)) return false;

  if (isDocumentAdmin(user)) return true;

  return Boolean(scope?.ownerUserId && scope.ownerUserId === userId);
}
