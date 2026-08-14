import { createHash, randomUUID } from 'node:crypto';
import type { MongoAuditLog } from '../db/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  tenantScopeFilterFromContext,
  withTenantFieldsFromContext,
} from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { escapeRegexLiteral } from '../utils/documentListQuery.js';
import { assertCanAccessDocument } from '../tenancy/documentOwnership.js';
import { reserveChainSlot, rollbackChainSlot } from './auditChain.js';
import {
  DOCUMENT_AUDIT_ACTION_LABELS,
  SYSTEM_DOCUMENT_AUDIT_ACTIONS,
  type DocumentAuditContext,
  type DocumentAuditEventInput,
  type DocumentAuditSeverity,
  type DocumentTimelineContext,
  type DocumentTimelineItem,
  type DocumentTrackingDetail,
  type DocumentTrackingListItem,
  type TrackingListStatus,
} from './documentAuditTypes.js';
import { summarizeAuditAction } from './documentAuditHelpers.js';
import { resolveTrackingDocumentName } from './documentNameSnapshot.js';
import { resolveAuditSeverity } from '../services/auditService.js';
import {
  ACTION_GROUP_RULES,
  resolveTrackingActionGroup,
  resolveTrackingEventStatus,
  type TrackingActionGroup,
} from '../services/tracking/trackingTypes.js';

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
      throw new ServiceError('Ação sistêmica exige actor system.', 'INVALID_AUDIT_ACTOR', 400);
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

  // `action` é normalizado na escrita para que as consultas possam usar o índice
  // { tenantId, action, createdAt } sem `$options: 'i'` — regex case-insensitive anula o índice
  // mesmo quando ancorada. Todas as actions já são constantes minúsculas; isto trava o contrato.
  const action = event.action.trim().toLowerCase();

  const ownerUserId = ctx.ownerUserId ?? ctx.actorUserId;
  const { auditLogs, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ownerUserId,
    membershipId: ctx.actorMembershipId,
  });

  const now = event.occurredAt ?? new Date();
  const result = event.result ?? (action.includes('failed') ? 'error' : 'success');
  const severity = resolveSeverity(action, event.severity, result);

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

  const id = `audit_${randomUUID()}`;

  // O carimbo da cadeia é reservado antes da inserção porque depende do hash do evento anterior.
  // Falhar aqui não pode impedir o registro do evento: uma trilha sem elo é um problema menor do
  // que um evento que não existe — a verificação sabe reportar o elo faltante.
  const chain = await reserveChainSlot(ctx.tenantId, {
    id,
    action,
    description: event.description,
    actorUserId: ctx.actorUserId,
    documentId: event.documentId ?? null,
    versionId: event.versionId ?? null,
    result,
    severity,
    occurredAt: now,
    metadata,
  });

  const doc = withTenantFieldsFromContext(
    storage,
    {
      _id: id,
      documentId: event.documentId ?? null,
      versionId: event.versionId ?? null,
      actor: buildActor(ctx),
      action,
      description: event.description,
      area: event.area ?? (event.documentId ? 'Documentos' : 'Sistema'),
      result,
      metadata,
      createdAt: now,
      occurredAt: now,
      severity,
      requestId: ctx.requestId,
      collectionPrefix: ctx.collectionPrefix,
      ...(chain ? { chain } : {}),
    },
    ownerUserId,
  ) as MongoAuditLog & { occurredAt: Date; severity: string };

  try {
    await auditLogs.insertOne(doc);
  } catch (error) {
    if (chain) await rollbackChainSlot(ctx.tenantId, chain);
    throw error;
  }

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

/**
 * `metadata.actionGroup` e `metadata.status` só são carimbados por `emitTrackingEvent`; evento
 * escrito direto por `createDocumentAuditLog` não tem nenhum dos dois. O valor efetivo é o carimbo
 * quando existe e a derivação da action quando não existe — e o filtro precisa cobrir os dois
 * casos, senão a consulta esconde justamente os eventos que a resposta mostra preenchidos.
 */
function effectiveFieldFilter(
  path: string,
  value: string,
  derived: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    $or: [
      { [path]: value },
      ...(derived ? [{ $and: [{ [path]: { $exists: false } }, derived] }] : []),
    ],
  };
}

function actionPrefixFilter(prefix: string): Record<string, unknown> {
  return { action: { $regex: `^${escapeRegexLiteral(prefix)}` } };
}

/** Reconstrói `resolveTrackingActionGroup` como consulta, honrando a precedência de primeira regra. */
export function buildTimelineActionGroupFilter(group: string): Record<string, unknown> | null {
  const normalized = group.trim();
  if (!normalized) return null;

  const clauses: Record<string, unknown>[] = [];
  ACTION_GROUP_RULES.forEach((rule, index) => {
    if (rule.group !== normalized) return;
    const blockers = ACTION_GROUP_RULES.slice(0, index)
      .filter((earlier) => earlier.group !== normalized)
      .map((earlier) => actionPrefixFilter(earlier.prefix));
    clauses.push(
      blockers.length
        ? { $and: [actionPrefixFilter(rule.prefix), { $nor: blockers }] }
        : actionPrefixFilter(rule.prefix),
    );
  });

  // `system` também é o destino de toda action que não casa com nenhuma regra.
  if (normalized === 'system') {
    clauses.push({ $nor: ACTION_GROUP_RULES.map((rule) => actionPrefixFilter(rule.prefix)) });
  }

  const derived =
    clauses.length === 0 ? null : clauses.length === 1 ? clauses[0]! : { $or: clauses };
  return effectiveFieldFilter('metadata.actionGroup', normalized, derived);
}

/** Ordem espelha `resolveTrackingEventStatus`: negado ganha de falho, que ganha de pendente. */
const STATUS_DERIVATION: ReadonlyArray<{
  status: Exclude<TrackingListStatus, 'success'>;
  filter: Record<string, unknown>;
}> = [
  { status: 'denied', filter: { $or: [{ action: { $regex: 'denied' } }, { result: 'denied' }] } },
  { status: 'failed', filter: { $or: [{ action: { $regex: 'failed' } }, { result: 'error' }] } },
  {
    status: 'pending',
    filter: { $or: [{ action: { $regex: 'pending' } }, { result: 'pending' }] },
  },
];

export function buildTimelineStatusFilter(status: string): Record<string, unknown> | null {
  const normalized = status.trim();
  if (!normalized) return null;

  let derived: Record<string, unknown> | null = null;

  if (normalized === 'success') {
    derived = { $nor: STATUS_DERIVATION.map((entry) => entry.filter) };
  } else {
    const index = STATUS_DERIVATION.findIndex((entry) => entry.status === normalized);
    if (index >= 0) {
      const own = STATUS_DERIVATION[index]!.filter;
      const earlier = STATUS_DERIVATION.slice(0, index).map((entry) => entry.filter);
      derived = earlier.length ? { $and: [own, { $nor: earlier }] } : own;
    }
  }

  return effectiveFieldFilter('metadata.status', normalized, derived);
}

/** Mesma tolerância de `buildTrackingQuery`: evento antigo só tem `createdAt`. */
function buildTimelineRangeFilter(from?: string, to?: string): Record<string, unknown> | null {
  const range: Record<string, Date> = {};

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) range.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) range.$lte = toDate;
  }

  if (Object.keys(range).length === 0) return null;

  return {
    $or: [{ occurredAt: range }, { occurredAt: { $exists: false }, createdAt: range }],
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function mapTimelineContext(
  metadata: Record<string, unknown>,
): DocumentTimelineContext | undefined {
  const security = resolveTrackingSecurity(metadata);
  if (!security) return undefined;

  const deviceType = optionalString(security.deviceType);
  const permissionResult = optionalString(security.permissionResult);

  const context: DocumentTimelineContext = {
    ipMasked: optionalString(security.ipAddressMasked),
    country: optionalString(security.country),
    region: optionalString(security.region),
    city: optionalString(security.city),
    timezone: optionalString(security.timezone),
    browser: optionalString(security.browser),
    browserVersion: optionalString(security.browserVersion),
    os: optionalString(security.os),
    osVersion: optionalString(security.osVersion),
    deviceType: deviceType as DocumentTimelineContext['deviceType'],
    sessionHash: optionalString(security.sessionIdHash),
    authMethod: optionalString(security.authMethod),
    isExternalGuest: optionalBoolean(security.isExternalGuest),
    isLocalNetwork: optionalBoolean(security.isLocalNetwork),
    permissionResult: permissionResult as DocumentTimelineContext['permissionResult'],
    permissionReason: optionalString(security.permissionReason),
    requiredPermission: optionalString(security.requiredPermission),
  };

  const present = Object.entries(context).filter(([, value]) => value !== undefined);
  return present.length ? (Object.fromEntries(present) as DocumentTimelineContext) : undefined;
}

export function mapDocumentTimelineRow(row: MongoAuditLog): DocumentTimelineItem {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const actor = (row.actor ?? {}) as Record<string, unknown>;
  const action = String(row.action);
  const result = optionalString(row.result);
  const occurredAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  const changes = Array.isArray(metadata.changes)
    ? (metadata.changes as DocumentTimelineItem['changes'])
    : undefined;

  // O `securityContext` sai do `metadata` porque agora tem contrato próprio em `context`; deixá-lo
  // nos dois lugares só devolveria a sopa que este campo existe para acabar.
  const metadataForDisplay = { ...metadata };
  delete metadataForDisplay.securityContext;
  delete metadataForDisplay.security;
  delete metadataForDisplay.securityAuditRestricted;

  const roles = Array.isArray(actor.roles)
    ? actor.roles.filter((role): role is string => typeof role === 'string')
    : undefined;

  return {
    id: String(row._id),
    action,
    actionGroup:
      (optionalString(metadata.actionGroup) as TrackingActionGroup | undefined) ??
      resolveTrackingActionGroup(action),
    status:
      (optionalString(metadata.status) as TrackingListStatus | undefined) ??
      resolveTrackingEventStatus(action, result),
    result,
    severity: (metadata.severity as DocumentAuditSeverity) ?? 'info',
    occurredAt,
    summary: summarizeAuditAction(action, DOCUMENT_AUDIT_ACTION_LABELS[action] ?? row.description),
    actor: {
      ...mapActor(actor),
      role: optionalString(actor.role),
      ...(roles?.length ? { roles } : {}),
    },
    context: mapTimelineContext(metadata),
    documentId: row.documentId,
    versionId: row.versionId,
    changes,
    metadata: sanitizeAuditMetadata(metadataForDisplay),
    requestId:
      optionalString(metadata.requestId) ??
      optionalString((row as Record<string, unknown>).requestId),
  };
}

export async function listDocumentTimeline(input: {
  ctx: DocumentAuditContext;
  documentId: string;
  limit?: number;
  cursor?: string;
  actionPrefix?: string;
  actionGroup?: string;
  status?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
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
    query.action = {
      $regex: `^${input.actionPrefix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    };
  }

  if (input.actorUserId?.trim()) {
    query['actor.userId'] = input.actorUserId.trim();
  }

  const scopedFilters = [
    input.actionGroup?.trim() ? buildTimelineActionGroupFilter(input.actionGroup) : null,
    input.status?.trim() ? buildTimelineStatusFilter(input.status) : null,
    buildTimelineRangeFilter(input.from, input.to),
  ].filter((filter): filter is Record<string, unknown> => filter !== null);

  if (scopedFilters.length) {
    query.$and = scopedFilters;
  }

  if (input.cursor?.trim()) {
    const cursorDate = new Date(input.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = await auditLogs
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .toArray();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const items: DocumentTimelineItem[] = page.map((row) => mapDocumentTimelineRow(row));

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.occurredAt ?? null) : null,
  };
}

export function hashAuditClientContext(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

const TRACKING_ACTION_PREFIX = /^(document\.|access\.|file_explorer\.)/;

function resolveTrackingSecurity(
  metadata: Record<string, unknown>,
): Record<string, unknown> | undefined {
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

function stripRestrictedTrackingMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
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
    sessionHash: typeof security?.sessionIdHash === 'string' ? security.sessionIdHash : undefined,
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
          $or: [{ occurredAt }, { occurredAt: { $exists: false }, createdAt: occurredAt }],
        },
      ];
    }
  }

  if (input.q?.trim()) {
    const regex = { $regex: escapeRegexLiteral(input.q), $options: 'i' };
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

  const documentIds = page.map((row) => row.documentId).filter((id): id is string => Boolean(id));
  const documentNames = await loadDocumentNames(documents, storage, documentIds);

  const items = page
    .filter((row) => TRACKING_ACTION_PREFIX.test(String(row.action)))
    .map((row) => mapTrackingRow(row as MongoAuditLog, documentNames));

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.occurredAt ?? null) : null,
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
