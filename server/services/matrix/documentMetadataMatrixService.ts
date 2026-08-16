import type { AuthUser } from '../../auth/types.js';
import { isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoDocumentVersion, MongoRuleField } from '../../db/types.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import { getMongoClassAndRule } from '../documentRulesService.js';
import { listDocuments } from '../documentService.js';

/**
 * Os metadados de vários documentos lado a lado, na mesma categoria.
 *
 * A ficha por documento já existia, e é ótima para consertar um. Ela não responde a pergunta do
 * gestor: "de todos os contratos, quais estão sem data de vencimento?". Para isso é preciso ver os
 * mesmos campos, em coluna, para o acervo inteiro.
 *
 * A categoria é obrigatória e essa é a decisão que faz a tela funcionar: cada categoria tem campos
 * diferentes, e uma matriz que misturasse todas viraria um queijo suíço de colunas vazias.
 */
export type MetadataMatrixColumn = {
  key: string;
  label: string;
  type: MongoRuleField['type'];
  required: boolean;
  /** Alimenta `searchMeta.validityDate` — é a coluna que liga os alertas de vencimento. */
  isValidity: boolean;
};

export type MetadataMatrixRow = {
  documentId: string;
  versionId?: string;
  fileName: string;
  ownerName?: string;
  updatedAt?: string;
  canEdit: boolean;
  values: Record<string, string | number | null>;
  /** Origem por campo: o que a IA extraiu e o que alguém corrigiu não valem a mesma coisa. */
  sources: Record<string, string | undefined>;
  missingRequired: string[];
};

export type DocumentMetadataMatrix = {
  categoryId: string;
  categoryName?: string;
  columns: MetadataMatrixColumn[];
  rows: MetadataMatrixRow[];
  pagination: { nextCursor: string | null };
};

const VALIDITY_KEYS = new Set([
  'validade',
  'datavalidade',
  'data_validade',
  'vencimento',
  'datavencimento',
  'data_vencimento',
  'expiracao',
  'dataexpiracao',
  'data_expiracao',
]);

function isValidityKey(key: string): boolean {
  return VALIDITY_KEYS.has(key.toLowerCase());
}

export async function buildDocumentMetadataMatrix(input: {
  tenantId: string;
  user: AuthUser;
  userId: string;
  membershipId?: string;
  categoryId: string;
  search?: string;
  cursor?: string;
  limit?: number;
}): Promise<DocumentMetadataMatrix> {
  const base: DocumentMetadataMatrix = {
    categoryId: input.categoryId,
    columns: [],
    rows: [],
    pagination: { nextCursor: null },
  };

  if (!isMongoNativeConfigured()) return base;

  const classAndRule = await getMongoClassAndRule({
    companyId: input.tenantId,
    classId: input.categoryId,
    ownerUserId: input.userId,
  });

  const columns: MetadataMatrixColumn[] = (classAndRule?.rule.fields ?? []).map((field) => ({
    key: field.key,
    label: field.label || field.key,
    type: field.type,
    required: Boolean(field.required),
    isValidity: isValidityKey(field.key),
  }));

  // Mesmo escopo da Biblioteca: administrador vê o tenant, dono vê os próprios documentos.
  const listed = await listDocuments({
    tenantId: input.tenantId,
    ownerUserId: input.userId,
    membershipId: input.membershipId,
    user: input.user,
    categoryId: input.categoryId,
    search: input.search,
    cursor: input.cursor,
    limit: input.limit ?? 25,
    excludeArchived: true,
  });

  const documents = (listed.items ?? []) as Array<Record<string, unknown>>;
  if (documents.length === 0) {
    return {
      ...base,
      categoryName: classAndRule?.docClass.name,
      columns,
      pagination: { nextCursor: listed.pagination?.nextCursor ?? null },
    };
  }

  const collections = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const versionIds = documents
    .map((doc) => (typeof doc.currentVersionId === 'string' ? doc.currentVersionId : null))
    .filter((id): id is string => Boolean(id));

  // Uma consulta para todas as versões da página: a ficha por documento faria uma por linha.
  const versions = versionIds.length
    ? await collections.documentVersions
        .find({
          _id: { $in: versionIds },
          ...tenantScopeFilterFromContext(collections.storage),
        } as Record<string, unknown>)
        .toArray()
    : [];

  const versionById = new Map<string, MongoDocumentVersion>(
    versions.map((version) => [version._id, version]),
  );

  const rows: MetadataMatrixRow[] = documents.map((doc) => {
    const documentId = String(doc.id ?? doc._id ?? '');
    const versionId = typeof doc.currentVersionId === 'string' ? doc.currentVersionId : undefined;
    const version = versionId ? versionById.get(versionId) : undefined;
    const metadata = version?.metadata ?? {};

    const values: Record<string, string | number | null> = {};
    const sources: Record<string, string | undefined> = {};
    const missingRequired: string[] = [];

    for (const column of columns) {
      const field = metadata[column.key];
      const value = field?.value ?? null;
      values[column.key] = value;
      sources[column.key] = field?.source;
      if (column.required && (value === null || value === '')) {
        missingRequired.push(column.key);
      }
    }

    const permissions = (doc.permissions ?? {}) as { canEditMetadata?: boolean };

    return {
      documentId,
      versionId,
      fileName: String(doc.currentFileName ?? doc.title ?? documentId),
      ownerName: typeof doc.ownerName === 'string' ? doc.ownerName : undefined,
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
      canEdit: Boolean(permissions.canEditMetadata),
      values,
      sources,
      missingRequired,
    };
  });

  return {
    categoryId: input.categoryId,
    categoryName: classAndRule?.docClass.name,
    columns,
    rows,
    pagination: { nextCursor: listed.pagination?.nextCursor ?? null },
  };
}
