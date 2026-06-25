import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoAuditLog } from '../db/types.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext, withTenantFieldsFromContext } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';

export async function listAuditEvents(filters: {
  tenantId?: string;
  ownerUserId?: string;
  documentId?: string;
  limit?: number;
}) {
  if (!filters.tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }

  const tenantId = filters.tenantId.trim();

  if (!isMongoNativeConfigured()) {
    return { events: [], total: 0 };
  }

  const { auditLogs, storage } = await getTenantCollections(tenantId, {
    userId: filters.ownerUserId,
  });
  const query: Record<string, unknown> = { ...tenantScopeFilterFromContext(storage) };
  if (filters.documentId) query.documentId = filters.documentId;

  const limit = filters.limit ?? 50;
  const events = await auditLogs.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  const total = await auditLogs.countDocuments(query);

  return {
    events: events.map((e) => ({
      id: String(e._id),
      tenantId: e.tenantId ?? e.companyId,
      documentId: e.documentId,
      actorUserId: e.actor?.userId,
      actorName: e.actor?.name,
      action: e.action,
      description: e.description,
      area: (e as Record<string, unknown>).area,
      result: (e as Record<string, unknown>).result,
      createdAt: e.createdAt,
      metadata: e.metadata,
    })),
    total,
  };
}

export async function createAuditEvent(input: {
  tenantId: string;
  ownerUserId?: string;
  documentId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  description: string;
  area?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isMongoNativeConfigured()) return null;

  const { auditLogs, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId ?? input.actorUserId,
  });
  const now = new Date();
  const event = withTenantFieldsFromContext(
    storage,
    {
    _id: `audit_${Date.now()}`,
    documentId: input.documentId,
    actor: { userId: input.actorUserId, name: input.actorName, role: 'user' },
    action: input.action,
    description: input.description,
    area: input.area,
    result: input.result ?? 'success',
    metadata: sanitizeAuditMetadata(input.metadata ?? {}),
    createdAt: now,
  },
    input.actorUserId,
  );

  await auditLogs.insertOne(event as unknown as MongoAuditLog);
  return { id: event._id, ...input, createdAt: now };
}
