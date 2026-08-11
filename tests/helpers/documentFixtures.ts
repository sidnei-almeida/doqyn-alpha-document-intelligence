import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { COLLECTIONS, REGISTRY_COLLECTIONS } from '../../server/db/constants.js';
import { getDb } from '../../server/db/mongoClient.js';
import type { MongoDocument, MongoTenant } from '../../server/db/types.js';
import { getTenantCollections } from '../../server/tenancy/getTenantCollections.js';
import { invalidateTenantRegistryCache } from '../../server/tenancy/tenantRegistryCache.js';
import { withTenantFieldsFromContext } from '../../server/tenancy/tenantQuery.js';
import { assertTestDatabase } from './assertTestDatabase.js';

/**
 * Fixtures pelo modelo real de isolamento (D-23).
 *
 * O isolamento multi-tenant é o campo `tenantId` gravado em cada documento, **não** um prefixo no
 * nome da coleção: `resolveSharedCollections()` devolve nomes achatados e compartilhados por todo
 * tenant. Documento plantado sem `tenantId` fica invisível para toda query da aplicação, então a
 * gravação passa por `getTenantCollections` + `withTenantFieldsFromContext`, o mesmo caminho que o
 * app usa.
 */

const plantedTenantIds = new Set<string>();

export type PlantedDocument = MongoDocument;

export async function plantBusinessTenant(tenantId: string): Promise<MongoTenant> {
  assertTestDatabase();

  const db = await getDb();
  const now = new Date();

  const tenant: MongoTenant = {
    _id: tenantId,
    tenantId,
    companyId: tenantId,
    tenantType: 'business',
    taxIdType: 'CNPJ',
    taxIdMasked: '**.***.***/0001-**',
    taxIdHash: `taxhash_${tenantId}`,
    displayName: `Tenant de teste ${tenantId}`,
    slug: tenantId.replace(/_/g, '-'),
    status: 'active',
    isolation: {
      strategy: 'collection_prefix',
      // Prefixo vazio dispara TENANT_MISCONFIGURED e CPF/CNPJ cru dispara UNSAFE_COLLECTION_PREFIX
      // em `resolveTenantCollectionPrefix`. O próprio tenantId é seguro nos dois critérios.
      collectionPrefix: tenantId,
    },
    // `bucketName` presente evita que `resolveTenantStorageScopeForTenant` chame o registry de
    // bucket, que tentaria falar com a API da Cloudflare.
    storage: {
      provider: 'cloudflare_r2',
      mode: 'per_tenant',
      bucketName: `doqyn-test-${tenantId.replace(/_/g, '-')}`,
      bucketAlias: `Tenant de teste ${tenantId}`,
      bucketStatus: 'ready',
    },
    createdAt: now,
    updatedAt: now,
  };

  await db
    .collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants)
    .replaceOne({ _id: tenantId }, tenant, { upsert: true });

  await invalidateTenantRegistryCache(tenantId);
  plantedTenantIds.add(tenantId);

  return tenant;
}

export type PlantDocumentInput = {
  tenantId: string;
  ownerUserId: string;
  documentId?: string;
  classId?: string;
  className?: string;
  title?: string;
};

export async function plantDocument(input: PlantDocumentInput): Promise<PlantedDocument> {
  assertTestDatabase();

  const { documents, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  const documentId = input.documentId ?? `doc_test_${randomUUID()}`;
  const now = new Date();

  const payload = {
    _id: documentId,
    documentCode: documentId.toUpperCase(),
    currentVersionId: `ver_${documentId}`,
    currentVersionLabel: 'v1',
    versionCount: 1,
    classId: input.classId ?? 'cat_test_contratos',
    className: input.className ?? 'Contratos',
    title: input.title ?? 'Documento de teste',
    currentFileName: 'documento-de-teste.pdf',
    status: 'active' as const,
    processingStatus: 'processed' as const,
    access: {
      viewGroupIds: [],
      downloadGroupIds: [],
      updateGroupIds: [],
      auditGroupIds: [],
      shareGroupIds: [],
    },
    createdBy: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
    // `deletedAt` é omitido de propósito: o filtro de soft delete exclui documento que o carregue.
  };

  const doc = withTenantFieldsFromContext(storage, payload, input.ownerUserId);
  await documents.insertOne(doc as unknown as MongoDocument);
  plantedTenantIds.add(input.tenantId);

  return doc as unknown as MongoDocument;
}

/**
 * Remove tudo o que foi plantado, por `tenantId`.
 *
 * Inclui `audit_logs` porque negação de acesso emite evento de tracking — sem isso a coleção cresce
 * a cada execução da suíte.
 */
export async function cleanupFixtures(): Promise<void> {
  if (plantedTenantIds.size === 0) return;
  assertTestDatabase();

  const db = await getDb();
  const tenantIds = [...plantedTenantIds];
  const scoped = { tenantId: { $in: tenantIds } };

  await Promise.all([
    db.collection(COLLECTIONS.documents).deleteMany(scoped),
    db.collection(COLLECTIONS.documentVersions).deleteMany(scoped),
    db.collection(COLLECTIONS.auditLogs).deleteMany(scoped),
    db.collection(COLLECTIONS.documentGroupMembers).deleteMany(scoped),
    db.collection(COLLECTIONS.documentRules).deleteMany(scoped),
    db.collection(COLLECTIONS.documentCategories).deleteMany(scoped),
    db.collection(REGISTRY_COLLECTIONS.tenantMembers).deleteMany(scoped),
    db.collection(REGISTRY_COLLECTIONS.companyMembers).deleteMany(scoped),
    db.collection(REGISTRY_COLLECTIONS.tenants).deleteMany({ tenantId: { $in: tenantIds } }),
  ]);

  await invalidateTenantRegistryCache(...tenantIds);
  plantedTenantIds.clear();
}
