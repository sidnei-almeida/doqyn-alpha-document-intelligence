import type { AuthUser } from '../../auth/types.js';
import { isDocumentAdmin } from '../../tenancy/documentAccess.js';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  MongoDocumentGroup,
  MongoDocumentShareGrant,
  MongoExternalDocumentShareGrant,
} from '../../db/types.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import {
  loadGovernanceAccessIndex,
  type GovernanceAccessIndex,
} from '../../tenancy/governanceAccessIndex.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { listDocuments } from '../documentService.js';

/**
 * Quem alcança cada documento, e por quê.
 *
 * O acesso nasce de quatro lugares diferentes — ser dono, ser administrador do tenant, estar num
 * grupo que a regra da categoria autoriza, ou ter recebido um compartilhamento direto. Espalhados
 * por quatro telas, ninguém consegue responder "quem lê este contrato?" sem cruzar as quatro na
 * cabeça.
 *
 * O que esta matriz devolve é a resposta pronta **com a origem junto**. A origem não é enfeite: é o
 * que impede o administrador de tentar "revogar" na tela um acesso que vem de regra de categoria e
 * não sai por ali — ele sai mudando a regra, que vale para todos os documentos daquela categoria.
 */
export type DocumentAccessOrigin = 'owner' | 'admin' | 'governance' | 'share';

export type DocumentAccessCell = {
  documentId: string;
  membershipId: string;
  origins: DocumentAccessOrigin[];
  canDownload: boolean;
  /** Grupos que sustentam o acesso por governança — o atalho para `/rules` usa isto. */
  viaGroupIds: string[];
  /** Presente quando há compartilhamento direto: é o que a matriz consegue revogar. */
  shareGrantId?: string;
};

export type DocumentAccessMatrixMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  groupIds: string[];
};

export type DocumentAccessMatrixRow = {
  documentId: string;
  fileName: string;
  categoryId?: string;
  categoryName?: string;
  ownerUserId?: string;
  ownerName?: string;
  updatedAt?: string;
  externalShareCount: number;
};

export type DocumentAccessMatrix = {
  members: DocumentAccessMatrixMember[];
  groups: Array<{ groupId: string; name: string }>;
  documents: DocumentAccessMatrixRow[];
  /** Esparsa de propósito: só quem tem acesso vira célula, ausência é ausência de acesso. */
  cells: DocumentAccessCell[];
  pagination: { nextCursor: string | null };
};

function isActiveGrant(grant: MongoDocumentShareGrant, now: number): boolean {
  if (grant.status !== 'active') return false;
  if (grant.revokedAt) return false;
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= now) return false;
  return true;
}

function governanceGroupsFor(
  index: GovernanceAccessIndex,
  categoryId: string | undefined,
  bucket: keyof GovernanceAccessIndex,
): Set<string> {
  if (!categoryId) return new Set();
  return index[bucket].get(categoryId) ?? new Set();
}

export async function buildDocumentAccessMatrix(input: {
  tenantId: string;
  user: AuthUser;
  userId: string;
  membershipId?: string;
  search?: string;
  categoryId?: string;
  cursor?: string;
  limit?: number;
}): Promise<DocumentAccessMatrix> {
  const empty: DocumentAccessMatrix = {
    members: [],
    groups: [],
    documents: [],
    cells: [],
    pagination: { nextCursor: null },
  };

  if (!isMongoNativeConfigured()) return empty;

  // A lista já resolve o escopo: administrador enxerga o tenant, dono enxerga os próprios. A
  // matriz não abre exceção nenhuma — herda quem pode ver o quê.
  const listed = await listDocuments({
    tenantId: input.tenantId,
    ownerUserId: input.userId,
    membershipId: input.membershipId,
    user: input.user,
    search: input.search,
    categoryId: input.categoryId,
    cursor: input.cursor,
    limit: input.limit ?? 25,
    excludeArchived: true,
  });

  const documents = (listed.items ?? []) as Array<Record<string, unknown>>;
  const documentIds = documents
    .map((doc) => String(doc.id ?? doc._id ?? ''))
    .filter((id) => id.length > 0);

  if (documentIds.length === 0) {
    return { ...empty, pagination: { nextCursor: listed.pagination?.nextCursor ?? null } };
  }

  const collections = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });
  const scope = tenantScopeFilterFromContext(collections.storage);
  const db = await getDb();
  const now = Date.now();

  const [members, groupRows, governance, grants, externalGrants] = await Promise.all([
    listOperationalTenantMembers(input.tenantId),
    collections.documentGroups
      ? collections.documentGroups.find({ ...scope, active: true } as Record<string, unknown>).toArray()
      : Promise.resolve([] as MongoDocumentGroup[]),
    loadGovernanceAccessIndex(input.tenantId, { ownerUserId: input.userId }),
    db
      .collection<MongoDocumentShareGrant>(SHARED_APP_COLLECTIONS.documentShareGrants)
      .find({ tenantId: input.tenantId, documentId: { $in: documentIds } })
      .toArray(),
    db
      .collection<MongoExternalDocumentShareGrant>(
        SHARED_APP_COLLECTIONS.externalDocumentShareGrants,
      )
      .find({ tenantId: input.tenantId, documentId: { $in: documentIds }, status: 'active' })
      .toArray(),
  ]);

  const groupMemberRows = collections.documentGroupMembers
    ? await collections.documentGroupMembers
        .find({ ...scope, active: true } as Record<string, unknown>)
        .toArray()
    : [];

  const groupIdsByMembership = new Map<string, string[]>();
  const groupIdsByUser = new Map<string, string[]>();
  for (const row of groupMemberRows) {
    if (row.membershipId) {
      groupIdsByMembership.set(row.membershipId, [
        ...(groupIdsByMembership.get(row.membershipId) ?? []),
        row.groupId,
      ]);
    }
    if (row.userId) {
      groupIdsByUser.set(row.userId, [...(groupIdsByUser.get(row.userId) ?? []), row.groupId]);
    }
  }

  const matrixMembers: DocumentAccessMatrixMember[] = members
    .filter((member) => member.status === 'active')
    .map((member) => {
      const userId = member.authUserId ?? member.memberId;
      const groupIds = [
        ...new Set([
          ...(groupIdsByMembership.get(member.memberId) ?? []),
          ...(groupIdsByUser.get(userId) ?? []),
        ]),
      ];

      return {
        membershipId: member.memberId,
        userId,
        name: [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.email,
        email: member.email,
        isAdmin: (member.tenantRoles ?? []).some((role) => role === 'company_admin'),
        groupIds,
      };
    });

  const externalCountByDocument = new Map<string, number>();
  for (const grant of externalGrants) {
    externalCountByDocument.set(
      grant.documentId,
      (externalCountByDocument.get(grant.documentId) ?? 0) + 1,
    );
  }

  const activeGrantsByDocument = new Map<string, MongoDocumentShareGrant[]>();
  for (const grant of grants) {
    if (!isActiveGrant(grant, now)) continue;
    activeGrantsByDocument.set(grant.documentId, [
      ...(activeGrantsByDocument.get(grant.documentId) ?? []),
      grant,
    ]);
  }

  const rows: DocumentAccessMatrixRow[] = [];
  const cells: DocumentAccessCell[] = [];

  for (const doc of documents) {
    const documentId = String(doc.id ?? doc._id ?? '');
    if (!documentId) continue;

    const categoryId = typeof doc.classId === 'string' ? doc.classId : undefined;
    const ownerUserId = typeof doc.ownerUserId === 'string' ? doc.ownerUserId : undefined;

    rows.push({
      documentId,
      fileName: String(doc.currentFileName ?? doc.title ?? documentId),
      categoryId,
      categoryName: typeof doc.className === 'string' ? doc.className : undefined,
      ownerUserId,
      ownerName: typeof doc.ownerName === 'string' ? doc.ownerName : undefined,
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
      externalShareCount: externalCountByDocument.get(documentId) ?? 0,
    });

    const viewGroups = governanceGroupsFor(governance, categoryId, 'viewByCategory');
    const downloadGroups = governanceGroupsFor(governance, categoryId, 'downloadByCategory');
    const docGrants = activeGrantsByDocument.get(documentId) ?? [];

    for (const member of matrixMembers) {
      const origins: DocumentAccessOrigin[] = [];
      const viaGroupIds = member.groupIds.filter((groupId) => viewGroups.has(groupId));
      let canDownload = false;
      let shareGrantId: string | undefined;

      if (ownerUserId && member.userId === ownerUserId) {
        origins.push('owner');
        canDownload = true;
      }

      if (member.isAdmin) {
        origins.push('admin');
        canDownload = true;
      }

      if (viaGroupIds.length > 0) {
        origins.push('governance');
        canDownload =
          canDownload || member.groupIds.some((groupId) => downloadGroups.has(groupId));
      }

      const grant = docGrants.find((entry) => entry.sharedWithUserId === member.userId);
      if (grant) {
        origins.push('share');
        canDownload = canDownload || Boolean(grant.permissions?.canDownload);
        shareGrantId = grant._id;
      }

      if (origins.length === 0) continue;

      cells.push({
        documentId,
        membershipId: member.membershipId,
        origins,
        canDownload,
        viaGroupIds,
        shareGrantId,
      });
    }
  }

  return {
    members: matrixMembers,
    groups: groupRows.map((group) => ({ groupId: group._id, name: group.name })),
    documents: rows,
    cells,
    pagination: { nextCursor: listed.pagination?.nextCursor ?? null },
  };
}

/** Só administrador do tenant enxerga a matriz inteira; o dono enxerga a fatia dele. */
export function canSeeWholeTenantMatrix(user: AuthUser): boolean {
  return isDocumentAdmin(user);
}
