import type { Collection, Db } from 'mongodb';
import { getDb } from '../db/mongoClient.js';
import type {
  MongoAccessGroup,
  MongoAuditLog,
  MongoDocument,
  MongoDocumentAccessRule,
  MongoDocumentCategory,
  MongoDocumentClass,
  MongoDocumentExtractionRule,
  MongoDocumentGroup,
  MongoDocumentGroupMember,
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
  /** @deprecated legado */
  documentClasses?: Collection<MongoDocumentClass>;
  documentCategories?: Collection<MongoDocumentCategory>;
  documentGroups?: Collection<MongoDocumentGroup>;
  documentGroupMembers?: Collection<MongoDocumentGroupMember>;
  documentRules?: Collection<MongoDocumentAccessRule>;
  documentExtractionRules?: Collection<MongoDocumentExtractionRule>;
};

export type TenantDbCollections = {
  accessGroups: Collection<MongoAccessGroup> | undefined;
  documentClasses: Collection<MongoDocumentClass> | undefined;
  documentCategories: Collection<MongoDocumentCategory> | undefined;
  documentGroups: Collection<MongoDocumentGroup> | undefined;
  documentGroupMembers: Collection<MongoDocumentGroupMember> | undefined;
  documentRules: Collection<MongoDocumentAccessRule> | undefined;
  documentExtractionRules: Collection<MongoDocumentExtractionRule> | undefined;
  documents: Collection<MongoDocument>;
  documentVersions: Collection<MongoDocumentVersion>;
  processingJobs: Collection<MongoProcessingJob>;
  auditLogs: Collection<MongoAuditLog>;
};

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
    documentCategories: resolvedNames.documentCategories
      ? db.collection<MongoDocumentCategory>(resolvedNames.documentCategories)
      : undefined,
    documentGroups: resolvedNames.documentGroups
      ? db.collection<MongoDocumentGroup>(resolvedNames.documentGroups)
      : undefined,
    documentGroupMembers: resolvedNames.documentGroupMembers
      ? db.collection<MongoDocumentGroupMember>(resolvedNames.documentGroupMembers)
      : undefined,
    documentRules: resolvedNames.documentRules
      ? db.collection<MongoDocumentAccessRule>(resolvedNames.documentRules)
      : undefined,
    documentExtractionRules: resolvedNames.documentExtractionRules
      ? db.collection<MongoDocumentExtractionRule>(resolvedNames.documentExtractionRules)
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
