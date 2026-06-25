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

export type TenantCollections = {
  tenant: MongoTenant;
  names: ResolvedTenantCollectionNames;
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
export function getTenantDbCollections(db: Db, tenant: MongoTenant): TenantDbCollections {
  const names = resolveTenantCollectionNames(tenant);

  return {
    documents: db.collection<MongoDocument>(names.documents),
    documentVersions: db.collection<MongoDocumentVersion>(names.documentVersions),
    processingJobs: db.collection<MongoProcessingJob>(names.processingJobs),
    auditLogs: db.collection<MongoAuditLog>(names.auditLogs),
    accessGroups: names.accessGroups
      ? db.collection<MongoAccessGroup>(names.accessGroups)
      : undefined,
    documentClasses: names.documentClasses
      ? db.collection<MongoDocumentClass>(names.documentClasses)
      : undefined,
    documentRules: names.documentRules
      ? db.collection<MongoDocumentRule>(names.documentRules)
      : undefined,
  };
}

export async function getTenantCollections(tenantId: string): Promise<TenantCollections> {
  const tenant = await resolveActiveTenant(tenantId);
  const names = resolveTenantCollectionNames(tenant);
  const db = await getDb();
  const collections = getTenantDbCollections(db, tenant);

  return {
    tenant,
    names,
    ...collections,
  };
}
