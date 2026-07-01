import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoAuditLog } from '../db/types.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext, withTenantFieldsFromContext } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';

export type AuditEventSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';

export type AuditEventDto = {
  id: string;
  tenantId: string;
  documentId?: string | null;
  actorUserId?: string;
  actorName?: string;
  action: string;
  description: string;
  area?: string;
  result?: string;
  severity: AuditEventSeverity;
  source: 'document' | 'user' | 'system';
  createdAt: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
};

const CRITICAL_ACTION_PATTERNS = [
  'blocked',
  'rejected',
  'denied',
  'forbidden',
  'failed',
  'error',
  'revoke',
];

export const SECURITY_ACTION_PATTERNS = [
  'USER_BLOCKED',
  'USER_REJECTED',
  'KEYCLOAK_USER_DISABLED',
  'login.failed',
  'login_failed',
  'access_denied',
  'permission_denied',
  'password',
  'session.revoked',
  'session_revoked',
  'blocked',
  'denied',
  'forbidden',
  'revoke',
  'suspicious',
];

const USER_AUDIT_PREFIXES = ['USER_', 'KEYCLOAK_', 'NOTIFICATION_'];

export function resolveAuditSeverity(
  action: string,
  result?: string | null,
): AuditEventSeverity {
  const normalizedAction = action.toLowerCase();
  const normalizedResult = result?.toLowerCase();

  if (normalizedResult === 'error') return 'error';
  if (CRITICAL_ACTION_PATTERNS.some((pattern) => normalizedAction.includes(pattern))) {
    return 'critical';
  }
  if (normalizedResult === 'warning') return 'warning';
  if (normalizedResult === 'success') return 'success';
  return 'info';
}

export function resolveAuditSource(action: string): AuditEventDto['source'] {
  if (USER_AUDIT_PREFIXES.some((prefix) => action.startsWith(prefix))) return 'user';
  if (action.startsWith('document.')) return 'document';
  return 'system';
}

function mapAuditLog(event: MongoAuditLog): AuditEventDto {
  const result = (event as Record<string, unknown>).result as string | undefined;
  const area = (event as Record<string, unknown>).area as string | undefined;
  const metadata = event.metadata ?? {};
  const requestId =
    typeof metadata.requestId === 'string'
      ? metadata.requestId
      : typeof metadata.request_id === 'string'
        ? metadata.request_id
        : undefined;

  return {
    id: String(event._id),
    tenantId: event.tenantId ?? event.companyId,
    documentId: event.documentId,
    actorUserId: event.actor?.userId,
    actorName: event.actor?.name,
    action: event.action,
    description: event.description,
    area: area ?? (event.documentId ? 'Documentos' : 'Administração'),
    result,
    severity: resolveAuditSeverity(event.action, result),
    source: resolveAuditSource(event.action),
    createdAt:
      event.createdAt instanceof Date ? event.createdAt.toISOString() : String(event.createdAt),
    metadata,
    requestId,
  };
}

function buildTextSearch(query: Record<string, unknown>, q?: string) {
  if (!q?.trim()) return;
  const regex = { $regex: q.trim(), $options: 'i' };
  query.$or = [
    { description: regex },
    { action: regex },
    { 'actor.name': regex },
    { 'actor.userId': regex },
    { documentId: regex },
  ];
}

function buildSeverityFilter(severity?: string): Record<string, unknown> | null {
  if (!severity?.trim()) return null;

  switch (severity.trim()) {
    case 'success':
      return { result: 'success' };
    case 'warning':
      return { result: 'warning' };
    case 'error':
      return { $or: [{ result: 'error' }, { action: { $regex: 'error|failed', $options: 'i' } }] };
    case 'critical':
      return {
        action: {
          $regex: CRITICAL_ACTION_PATTERNS.join('|'),
          $options: 'i',
        },
      };
    case 'info':
      return {
        $and: [
          { $or: [{ result: { $exists: false } }, { result: 'info' }] },
          {
            action: {
              $not: {
                $regex: CRITICAL_ACTION_PATTERNS.join('|'),
                $options: 'i',
              },
            },
          },
        ],
      };
    default:
      return null;
  }
}

export async function listAuditEvents(filters: {
  tenantId?: string;
  ownerUserId?: string;
  documentId?: string;
  q?: string;
  type?: string;
  severity?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
  category?: 'security';
}) {
  if (!filters.tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }

  const tenantId = filters.tenantId.trim();

  if (!isMongoNativeConfigured()) {
    return { events: [] as AuditEventDto[], total: 0, nextCursor: null as string | null };
  }

  const { auditLogs, storage } = await getTenantCollections(tenantId, {
    userId: filters.ownerUserId,
  });
  const query: Record<string, unknown> = { ...tenantScopeFilterFromContext(storage) };

  if (filters.documentId) query.documentId = filters.documentId;
  if (filters.type?.trim()) query.action = filters.type.trim();
  if (filters.actorId?.trim()) query['actor.userId'] = filters.actorId.trim();

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) {
      const fromDate = new Date(filters.from);
      if (!Number.isNaN(fromDate.getTime())) createdAt.$gte = fromDate;
    }
    if (filters.to) {
      const toDate = new Date(filters.to);
      if (!Number.isNaN(toDate.getTime())) createdAt.$lte = toDate;
    }
    if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;
  }

  buildTextSearch(query, filters.q);

  if (filters.category === 'security') {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        action: {
          $regex: SECURITY_ACTION_PATTERNS.join('|'),
          $options: 'i',
        },
      },
    ];
  }

  const severityFilter = buildSeverityFilter(filters.severity);
  if (severityFilter) {
    query.$and = [...(Array.isArray(query.$and) ? query.$and : []), severityFilter];
  }

  if (filters.cursor?.trim()) {
    const cursorDate = new Date(filters.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = {
        ...(typeof query.createdAt === 'object' && query.createdAt !== null ? query.createdAt : {}),
        $lt: cursorDate,
      };
    }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const events = await auditLogs.find(query).sort({ createdAt: -1 }).limit(limit + 1).toArray();
  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const total = await auditLogs.countDocuments(query);
  const mapped = page.map((event) => mapAuditLog(event as MongoAuditLog));
  const nextCursor = hasMore ? mapped[mapped.length - 1]?.createdAt ?? null : null;

  return { events: mapped, total, nextCursor };
}

export async function getAuditOverview(filters: { tenantId?: string; ownerUserId?: string }) {
  if (!filters.tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }

  const tenantId = filters.tenantId.trim();

  if (!isMongoNativeConfigured()) {
    return {
      todayEventsCount: 0,
      criticalEventsCount: 0,
      totalEventsCount: 0,
    };
  }

  const { auditLogs, storage } = await getTenantCollections(tenantId, {
    userId: filters.ownerUserId,
  });
  const baseQuery = tenantScopeFilterFromContext(storage);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayEventsCount, criticalEventsCount, totalEventsCount] = await Promise.all([
    auditLogs.countDocuments({
      ...baseQuery,
      createdAt: { $gte: startOfToday },
    }),
    auditLogs.countDocuments({
      ...baseQuery,
      action: {
        $regex: CRITICAL_ACTION_PATTERNS.join('|'),
        $options: 'i',
      },
    }),
    auditLogs.countDocuments(baseQuery),
  ]);

  return { todayEventsCount, criticalEventsCount, totalEventsCount };
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
