import { SHARED_APP_COLLECTIONS } from '../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocumentShareGrant } from '../db/types.js';
import type { DocumentAccessPermissionsWithShare } from './documentShareAccess.js';

/**
 * Em que acervo este documento mora, para esta pessoa.
 *
 * Quase sempre no tenant da sessão. A exceção é o documento que veio de outra empresa e foi
 * aceito: ele continua no acervo de origem — não é copiado, de propósito, para que revogar de um
 * lado feche o acesso do outro — e ler dali exige trocar o escopo antes da consulta.
 *
 * Vive num lugar só porque são quatro caminhos de leitura com formatos diferentes (arquivo,
 * preview, manifesto, favorito). Cada um resolvendo por conta própria seria a garantia de que um
 * ficaria para trás, recusando calado enquanto os outros liberam.
 */
export type DocumentReadScope = {
  tenantId: string;
  ownerUserId?: string;
  /** Presente só quando o documento mora em outra empresa. */
  foreignGrant: MongoDocumentShareGrant | null;
};

export async function resolveDocumentReadScope(input: {
  tenantId: string;
  ownerUserId?: string;
  documentId: string;
  userId: string;
}): Promise<DocumentReadScope> {
  const own: DocumentReadScope = {
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    foreignGrant: null,
  };

  if (!isMongoNativeConfigured()) return own;

  const db = await getDb();
  const grant = await db
    .collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants)
    .findOne({
      documentId: input.documentId,
      sharedWithUserId: input.userId,
      status: 'active',
      'inbound.status': 'accepted',
      'inbound.recipientTenantId': input.tenantId,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    } as Record<string, unknown>);

  if (!grant) return own;

  return {
    // O documento mora onde nasceu.
    tenantId: grant.tenantId,
    // E o escopo é o de quem enviou: pedir as coleções em nome de quem lê resolveria o acervo
    // errado num tenant individual.
    ownerUserId: grant.sharedByUserId,
    foreignGrant: grant,
  };
}

/**
 * O que a concessão dá, e nada além disso.
 *
 * A resolução normal de permissão consulta a governança **do tenant de quem lê** e dá tudo a quem
 * é administrador lá. Aplicá-la a um documento de outra empresa faria o admin de qualquer tenant
 * ganhar poder total sobre o que outra empresa apenas emprestou a um funcionário dele.
 *
 * Aqui não há governança a consultar: quem autorizou foi a concessão, e o que ela concede é ver e,
 * se dito, baixar. Nunca editar, nunca mover, nunca repassar.
 */
export function foreignDocumentPermissions(
  grant: MongoDocumentShareGrant,
): DocumentAccessPermissionsWithShare {
  return {
    canPreview: grant.permissions.canView === true,
    canDownload: grant.permissions.canDownload === true,
    canEditMetadata: false,
    canUpdate: false,
    canTrash: false,
    canContribute: false,
    canTransferOwnership: false,
    // Não há meio-termo a pedir: o portão de aprovação é do tenant que governa o documento, e
    // quem lê não é dele. Pedir a um administrador que não alcança o documento seria um pedido
    // que ninguém pode atender.
    requiresApproval: { download: false, update: false },
    canShare: false,
    shareRequiresApproval: false,
    sharedViaGrant: true,
  };
}

/** Só para o caso de a concessão desaparecer entre a resolução do escopo e o uso. */
export function isForeignScope(scope: DocumentReadScope): scope is DocumentReadScope & {
  foreignGrant: MongoDocumentShareGrant;
} {
  return scope.foreignGrant !== null;
}
