import type { Collection, Db } from 'mongodb';
import { getDb } from '../db/mongoClient.js';
import type {
  MongoAccessGroup,
  MongoAuditLog,
  MongoDocument,
  MongoDocumentClass,
  MongoDocumentRule,
  MongoDocumentVersion,
  MongoProcessingJob,
  MongoTenant,
} from '../db/types.js';
import {
  resolveActiveTenant,
  resolveTenantCollectionNames,
  type ResolvedTenantCollectionNames,
} from './tenantResolver.js';
import { resolveTenantStorageContext, type TenantStorageContext } from './tenantStorage.js';

export type TenantCollections = {
  tenant: MongoTenant;
  names: ResolvedTenantCollectionNames;
  storage: TenantStorageContext;
  documents: Collection<MongoDocument>;
  documentVersions: Collection<MongoDocumentVersion>;
  processingJobs: Collection<MongoProcessingJob>;
  auditLogs: Collection<MongoAuditLog>;
  accessGroups?: Collection<MongoAccessGroup>;
  documentClasses?: Collection<MongoDocumentClass>;
  documentRules?: Collection<MongoDocumentRule>;
};

export type TenantDbCollections = {
  accessGroups: Collection<MongoAccessGroup> | undefined;
  documentClasses: Collection<MongoDocumentClass> | undefined;
  documentRules: Collection<MongoDocumentRule> | undefined;
  documents: Collection<MongoDocument>;
  documentVersions: Collection<MongoDocumentVersion>;
  processingJobs: Collection<MongoProcessingJob>;
  auditLogs: Collection<MongoAuditLog>;
};

/** Resolve handles de coleção a partir de um tenant já carregado (sem I/O extra). */
export function getTenantDbCollections(
  db: Db,
  tenant: MongoTenant,
  names?: ResolvedTenantCollectionNames,
): TenantDbCollections {
  const resolvedNames = names ?? resolveTenantCollectionNames(tenant);

  return {
    documents: db.collection<MongoDocument>(resolvedNames.documents),
    documentVersions: db.collection<MongoDocumentVersion>(resolvedNames.documentVersions),
    processingJobs: db.collection<MongoProcessingJob>(resolvedNames.processingJobs),
    auditLogs: db.collection<MongoAuditLog>(resolvedNames.auditLogs),
    accessGroups: resolvedNames.accessGroups
      ? db.collection<MongoAccessGroup>(resolvedNames.accessGroups)
      : undefined,
    documentClasses: resolvedNames.documentClasses
      ? db.collection<MongoDocumentClass>(resolvedNames.documentClasses)
      : undefined,
    documentRules: resolvedNames.documentRules
      ? db.collection<MongoDocumentRule>(resolvedNames.documentRules)
      : undefined,
  };
}

export async function getTenantCollections(
  tenantId: string,
  opts?: { userId?: string; membershipId?: string },
): Promise<TenantCollections> {
  const tenant = await resolveActiveTenant(tenantId);
  const storage = resolveTenantStorageContext({
    tenant,
    userId: opts?.userId,
    membershipId: opts?.membershipId,
  });
  const names = storage.collections;
  const db = await getDb();
  const collections = getTenantDbCollections(db, tenant, names);

  return {
    tenant,
    names,
    storage,
    ...collections,
  };
}
