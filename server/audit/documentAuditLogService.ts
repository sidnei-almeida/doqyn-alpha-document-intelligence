import { createHash, randomUUID } from 'node:crypto';
import type { MongoAuditLog } from '../db/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext, withTenantFieldsFromContext } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { assertCanAccessDocument } from '../tenancy/documentOwnership.js';
import {
  DOCUMENT_AUDIT_ACTION_LABELS,
  SYSTEM_DOCUMENT_AUDIT_ACTIONS,
  type DocumentAuditContext,
  type DocumentAuditEventInput,
  type DocumentAuditSeverity,
  type DocumentTimelineItem,
  type DocumentTrackingDetail,
  type DocumentTrackingListItem,
} from './documentAuditTypes.js';
import { summarizeAuditAction } from './documentAuditHelpers.js';
import { resolveTrackingDocumentName } from './documentNameSnapshot.js';
import { resolveAuditSeverity } from '../services/auditService.js';

const SYSTEM_ACTOR = {
  userId: 'system',
  name: 'DOQYN System',
  role: 'system',
};

function resolveSeverity(
  action: string,
  input?: DocumentAuditSeverity,
  result?: string,
): DocumentAuditSeverity {
  if (input) return input;
  const mapped = resolveAuditSeverity(action, result);
  if (mapped === 'critical') return 'critical';
  if (mapped === 'error') return 'error';
  if (mapped === 'warning') return 'warning';
  if (mapped === 'success') return 'info';
  return 'info';
}

function assertValidActor(ctx: DocumentAuditContext, action: string): void {
  const isSystemAction = SYSTEM_DOCUMENT_AUDIT_ACTIONS.has(action as never);

  if (isSystemAction) {
    if (ctx.actorUserId !== 'system') {
      throw new ServiceError(
        'Ação sistêmica exige actor system.',
        'INVALID_AUDIT_ACTOR',
        400,
      );
    }
    return;
  }

  if (!ctx.actorUserId?.trim() || ctx.actorUserId === 'system') {
    throw new ServiceError(
      'actorUserId é obrigatório para auditoria documental.',
      'AUDIT_ACTOR_REQUIRED',
      400,
    );
  }
}

function buildActor(ctx: DocumentAuditContext) {
  if (ctx.actorUserId === 'system') {
    return SYSTEM_ACTOR;
  }

  return {
    userId: ctx.actorUserId,
    name: ctx.actorDisplayName?.trim() || ctx.actorEmail?.trim() || ctx.actorUserId,
    role: ctx.actorRole ?? ctx.actorRoles?.[0] ?? 'user',
    membershipId: ctx.actorMembershipId,
    roles: ctx.actorRoles,
    accessGroupIds: ctx.actorAccessGroupIds,
    documentGroupIds: ctx.actorDocumentGroupIds,
    displayNameSnapshot: ctx.actorDisplayName,
    emailSnapshot: ctx.actorEmail,
  };
}

export async function createDocumentAuditLog(
  ctx: DocumentAuditContext,
  event: DocumentAuditEventInput,
): Promise<{ id: string } | null> {
  assertValidActor(ctx, event.action);

  if (!isMongoNativeConfigured()) return null;

  const ownerUserId = ctx.ownerUserId ?? ctx.actorUserId;
  const { auditLogs, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ownerUserId,
    membershipId: ctx.actorMembershipId,
  });

  const now = event.occurredAt ?? new Date();
  const result = event.result ?? (event.action.includes('failed') ? 'error' : 'success');
  const severity = resolveSeverity(event.action, event.severity, result);

  const metadata = sanitizeAuditMetadata({
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(event.uploadJobId ? { uploadJobId: event.uploadJobId } : {}),
    ...(event.analysisJobId ? { analysisJobId: event.analysisJobId } : {}),
    ...(event.target ? { target: event.target } : {}),
    ...(event.before ? { before: event.before } : {}),
    ...(event.after ? { after: event.after } : {}),
    ...(event.changes?.length ? { changes: event.changes } : {}),
    severity,
    source: event.metadata?.source ?? 'api',
    ...(event.metadata ?? {}),
  });

  const doc = withTenantFieldsFromContext(
    storage,
    {
      _id: `audit_${randomUUID()}`,
      documentId: event.documentId ?? null,
      versionId: event.versionId ?? null,
      actor: buildActor(ctx),
      action: event.action,
      description: event.description,
      area: event.area ?? (event.documentId ? 'Documentos' : 'Sistema'),
      result,
      metadata,
      createdAt: now,
      occurredAt: now,
      severity,
      requestId: ctx.requestId,
      collectionPrefix: ctx.collectionPrefix,
    },
    ownerUserId,
  ) as MongoAuditLog & { occurredAt: Date; severity: string };

  await auditLogs.insertOne(doc);
  return { id: String(doc._id) };
}

export async function createDocumentAuditLogs(
  ctx: DocumentAuditContext,
  events: DocumentAuditEventInput[],
): Promise<void> {
  for (const event of events) {
    await createDocumentAuditLog(ctx, event);
  }
}

export async function listDocumentTimeline(input: {
  ctx: DocumentAuditContext;
  documentId: string;
  limit?: number;
  cursor?: string;
  actionPrefix?: string;
}): Promise<{ items: DocumentTimelineItem[]; nextCursor: string | null }> {
  if (!isMongoNativeConfigured()) {
    return { items: [], nextCursor: null };
  }

  const ownerUserId = input.ctx.ownerUserId ?? input.ctx.actorUserId;
  const { auditLogs, storage, documents } = await getTenantCollections(input.ctx.tenantId, {
    userId: ownerUserId,
    membershipId: input.ctx.actorMembershipId,
  });

  const document = await documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  assertCanAccessDocument(document as Record<string, unknown> | null, storage);

  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    documentId: input.documentId,
  };

  if (input.actionPrefix?.trim()) {
    query.action = { $regex: `^${input.actionPrefix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
  }

  if (input.cursor?.trim()) {
    const cursorDate = new Date(input.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = await auditLogs.find(query).sort({ createdAt: -1 }).limit(limit + 1).toArray();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const items: DocumentTimelineItem[] = page.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const actor = row.actor as Record<string, unknown>;
    const occurredAt =
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
    const changes = Array.isArray(metadata.changes)
      ? (metadata.changes as DocumentTimelineItem['changes'])
      : undefined;

    return {
      id: String(row._id),
      action: String(row.action),
      severity: (metadata.severity as DocumentTimelineItem['severity']) ?? 'info',
      occurredAt,
      summary: summarizeAuditAction(
        String(row.action),
        DOCUMENT_AUDIT_ACTION_LABELS[String(row.action)] ?? row.description,
      ),
      actor: {
        userId: String(actor.userId ?? ''),
        displayName:
          typeof actor.displayNameSnapshot === 'string'
            ? actor.displayNameSnapshot
            : typeof actor.name === 'string'
              ? actor.name
              : undefined,
        email: typeof actor.emailSnapshot === 'string' ? actor.emailSnapshot : undefined,
      },
      documentId: row.documentId,
      versionId: row.versionId,
      changes,
      metadata: sanitizeAuditMetadata(metadata),
      requestId:
        typeof metadata.requestId === 'string'
          ? metadata.requestId
          : typeof (row as Record<string, unknown>).requestId === 'string'
            ? String((row as Record<string, unknown>).requestId)
            : undefined,
    };
  });

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.occurredAt ?? null : null,
  };
}

export function hashAuditClientContext(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

const TRACKING_ACTION_PREFIX = /^(document\.|access\.|file_explorer\.)/;

function resolveTrackingSecurity(metadata: Record<string, unknown>): Record<string, unknown> | undefined {
  const securityContext =
    metadata.securityContext && typeof metadata.securityContext === 'object'
      ? (metadata.securityContext as Record<string, unknown>)
      : undefined;
  const legacySecurity =
    metadata.security && typeof metadata.security === 'object'
      ? (metadata.security as Record<string, unknown>)
      : undefined;
  return securityContext ?? legacySecurity;
}

function stripRestrictedTrackingMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const result = { ...metadata };
  delete result.securityAuditRestricted;
  return result;
}

function mapActor(actor: Record<string, unknown>) {
  return {
    userId: String(actor.userId ?? ''),
    displayName:
      typeof actor.displayNameSnapshot === 'string'
        ? actor.displayNameSnapshot
        : typeof actor.name === 'string'
          ? actor.name
          : undefined,
    email: typeof actor.emailSnapshot === 'string' ? actor.emailSnapshot : undefined,
  };
}

function mapTrackingRow(
  row: MongoAuditLog,
  documentNames: Map<string, string>,
): DocumentTrackingListItem {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const actor = row.actor as Record<string, unknown>;
  const occurredAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  const documentId = row.documentId ?? null;
  const changes = Array.isArray(metadata.changes) ? metadata.changes : [];
  const resolvedName = resolveTrackingDocumentName({
    metadata,
    documentId,
    documentNames,
  });
  const versionLabel =
    typeof metadata.versionLabel === 'string' ? metadata.versionLabel : undefined;
  const security = resolveTrackingSecurity(metadata);

  return {
    id: String(row._id),
    occurredAt,
    action: String(row.action),
    severity: (metadata.severity as DocumentAuditSeverity) ?? 'info',
    summary: summarizeAuditAction(
      String(row.action),
      DOCUMENT_AUDIT_ACTION_LABELS[String(row.action)] ?? row.description,
    ),
    document: {
      documentId,
      name: resolvedName,
      versionLabel,
    },
    versionId: row.versionId ?? null,
    actor: mapActor(actor),
    hasChanges: changes.length > 0,
    status: (metadata.status as DocumentTrackingListItem['status']) ?? undefined,
    actionGroup: typeof metadata.actionGroup === 'string' ? metadata.actionGroup : undefined,
    result: typeof row.result === 'string' ? row.result : undefined,
    sessionHash:
      typeof security?.sessionIdHash === 'string' ? security.sessionIdHash : undefined,
  };
}

function buildTrackingCategoryFilter(category?: string): Record<string, unknown> | null {
  if (!category?.trim() || category === 'all') return null;

  switch (category.trim()) {
    case 'upload':
      return { action: { $regex: '^document\\.upload_', $options: 'i' } };
    case 'analysis':
      return { action: { $regex: '^document\\.analysis_', $options: 'i' } };
    case 'edit':
      return {
        action: {
          $regex: '^document\\.(metadata_updated|filename_updated|category_updated)',
          $options: 'i',
        },
      };
    case 'download':
      return { action: 'document.downloaded' };
    case 'preview':
      return { action: { $regex: '^document\\.preview_', $options: 'i' } };
    case 'error':
      return {
        $or: [
          { action: { $regex: 'failed|error|denied', $options: 'i' } },
          { result: 'error' },
          { 'metadata.status': { $in: ['failed', 'denied'] } },
        ],
      };
    case 'access':
      return { action: { $regex: '^access\\.', $options: 'i' } };
    default:
      return null;
  }
}

function buildTrackingQuery(input: {
  storage: Awaited<ReturnType<typeof getTenantCollections>>['storage'];
  documentId?: string;
  versionId?: string;
  action?: string;
  severity?: string;
  status?: string;
  actionGroup?: string;
  requestId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  q?: string;
  category?: string;
  cursor?: string;
}): Record<string, unknown> {
  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(input.storage),
    action: { $regex: '^(document\\.|access\\.|file_explorer\\.)' },
  };

  if (input.documentId?.trim()) query.documentId = input.documentId.trim();
  if (input.versionId?.trim()) query.versionId = input.versionId.trim();
  if (input.action?.trim()) query.action = input.action.trim();
  if (input.requestId?.trim()) query.requestId = input.requestId.trim();
  if (input.actorUserId?.trim()) query['actor.userId'] = input.actorUserId.trim();

  if (input.status?.trim()) {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      { 'metadata.status': input.status.trim() },
    ];
  }

  if (input.actionGroup?.trim()) {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      { 'metadata.actionGroup': input.actionGroup.trim() },
    ];
  }

  if (input.from || input.to) {
    const occurredAt: Record<string, Date> = {};
    if (input.from) {
      const fromDate = new Date(input.from);
      if (!Number.isNaN(fromDate.getTime())) occurredAt.$gte = fromDate;
    }
    if (input.to) {
      const toDate = new Date(input.to);
      if (!Number.isNaN(toDate.getTime())) occurredAt.$lte = toDate;
    }
    if (Object.keys(occurredAt).length > 0) {
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        {
          $or: [
            { occurredAt },
            { occurredAt: { $exists: false }, createdAt: occurredAt },
          ],
        },
      ];
    }
  }

  if (input.q?.trim()) {
    const regex = { $regex: input.q.trim(), $options: 'i' };
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        $or: [
          { description: regex },
          { action: regex },
          { documentId: regex },
          { 'actor.name': regex },
          { 'actor.displayNameSnapshot': regex },
          { 'actor.emailSnapshot': regex },
        ],
      },
    ];
  }

  const categoryFilter = buildTrackingCategoryFilter(input.category);
  if (categoryFilter) {
    query.$and = [...(Array.isArray(query.$and) ? query.$and : []), categoryFilter];
  }

  if (input.severity?.trim()) {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      { 'metadata.severity': input.severity.trim() },
    ];
  }

  if (input.cursor?.trim()) {
    const cursorDate = new Date(input.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = {
        ...(typeof query.createdAt === 'object' && query.createdAt !== null ? query.createdAt : {}),
        $lt: cursorDate,
      };
    }
  }

  return query;
}

async function loadDocumentNames(
  documents: Awaited<ReturnType<typeof getTenantCollections>>['documents'],
  storage: Awaited<ReturnType<typeof getTenantCollections>>['storage'],
  documentIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(documentIds.filter(Boolean))];
  if (!uniqueIds.length) return names;

  const rows = await documents
    .find({
      _id: { $in: uniqueIds },
      ...tenantScopeFilterFromContext(storage),
    } as Record<string, unknown>)
    .project({ currentFileName: 1, title: 1, displayName: 1 })
    .toArray();

  for (const row of rows) {
    const doc = row as Record<string, unknown>;
    const name =
      (typeof doc.currentFileName === 'string' && doc.currentFileName) ||
      (typeof doc.title === 'string' && doc.title) ||
      (typeof doc.displayName === 'string' && doc.displayName) ||
      String(doc._id);
    names.set(String(doc._id), name);
  }

  return names;
}

export async function listDocumentTrackingEvents(input: {
  ctx: DocumentAuditContext;
  documentId?: string;
  versionId?: string;
  action?: string;
  severity?: string;
  status?: string;
  actionGroup?: string;
  requestId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  q?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: DocumentTrackingListItem[]; nextCursor: string | null }> {
  if (!isMongoNativeConfigured()) {
    return { items: [], nextCursor: null };
  }

  const ownerUserId = input.ctx.ownerUserId ?? input.ctx.actorUserId;
  const { auditLogs, storage, documents } = await getTenantCollections(input.ctx.tenantId, {
    userId: ownerUserId,
    membershipId: input.ctx.actorMembershipId,
  });

  const query = buildTrackingQuery({
    storage,
    documentId: input.documentId,
    versionId: input.versionId,
    action: input.action,
    severity: input.severity,
    status: input.status,
    actionGroup: input.actionGroup,
    requestId: input.requestId,
    actorUserId: input.actorUserId,
    from: input.from,
    to: input.to,
    q: input.q,
    category: input.category,
    cursor: input.cursor,
  });

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
  const rows = await auditLogs
    .find(query)
    .sort({ occurredAt: -1, createdAt: -1 })
    .limit(limit + 1)
    .toArray();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const documentIds = page
    .map((row) => row.documentId)
    .filter((id): id is string => Boolean(id));
  const documentNames = await loadDocumentNames(documents, storage, documentIds);

  const items = page
    .filter((row) => TRACKING_ACTION_PREFIX.test(String(row.action)))
    .map((row) => mapTrackingRow(row as MongoAuditLog, documentNames));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.occurredAt ?? null : null,
  };
}

export async function getDocumentTrackingEvent(input: {
  ctx: DocumentAuditContext;
  eventId: string;
}): Promise<DocumentTrackingDetail> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Evento não encontrado.', 'TRACKING_EVENT_NOT_FOUND', 404);
  }

  const ownerUserId = input.ctx.ownerUserId ?? input.ctx.actorUserId;
  const { auditLogs, storage, documents } = await getTenantCollections(input.ctx.tenantId, {
    userId: ownerUserId,
    membershipId: input.ctx.actorMembershipId,
  });

  const row = await auditLogs.findOne({
    _id: input.eventId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!row || !TRACKING_ACTION_PREFIX.test(String((row as MongoAuditLog).action))) {
    throw new ServiceError('Evento não encontrado.', 'TRACKING_EVENT_NOT_FOUND', 404);
  }

  const metadata = ((row as MongoAuditLog).metadata ?? {}) as Record<string, unknown>;
  const documentId = (row as MongoAuditLog).documentId ?? null;
  const documentNames = documentId
    ? await loadDocumentNames(documents, storage, [documentId])
    : new Map<string, string>();

  const base = mapTrackingRow(row as MongoAuditLog, documentNames);
  const changes = Array.isArray(metadata.changes)
    ? (metadata.changes as DocumentTrackingDetail['changes'])
    : undefined;

  const security = resolveTrackingSecurity(metadata);
  const publicMetadata = stripRestrictedTrackingMetadata(metadata);
  const metadataForDisplay = { ...publicMetadata };
  delete metadataForDisplay.securityContext;
  delete metadataForDisplay.security;
  delete metadataForDisplay.securityAuditRestricted;

  return {
    ...base,
    tenantId: input.ctx.tenantId,
    description: (row as MongoAuditLog).description,
    changes,
    metadata: sanitizeAuditMetadata(metadataForDisplay),
    security: security ? sanitizeAuditMetadata(security) : undefined,
    securityContext: security ? sanitizeAuditMetadata(security) : undefined,
    requestId:
      typeof metadata.requestId === 'string'
        ? metadata.requestId
        : typeof (row as Record<string, unknown>).requestId === 'string'
          ? String((row as Record<string, unknown>).requestId)
          : undefined,
    durationMs: typeof metadata.durationMs === 'number' ? metadata.durationMs : undefined,
  };
}

export { sanitizeAuditMetadata as sanitizeAuditPayload } from '../utils/sanitizeAuditMetadata.js';
export { buildAuditChangeSet as buildChangeSet } from './documentAuditHelpers.js';
