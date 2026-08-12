import type { AuditEvent, AuditEventFilters } from '@/types/audit';

const FORBIDDEN_KEY_PATTERNS = [
  /password/i,
  /senha/i,
  /token/i,
  /secret/i,
  /apikey/i,
  /cookie/i,
  /mongodb/i,
  /gsk_/i,
  /^cpf$/i,
  /^cnpj$/i,
  /taxidraw/i,
  /whatsapp/i,
  /phone/i,
];

const REDACTED = '[redigido]';

function shouldRedactKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactStringValue(value: string): string {
  let text = value;
  text = text.replace(/gsk_[A-Za-z0-9]+/g, REDACTED);
  text = text.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, REDACTED);
  text = text.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, REDACTED);
  text = text.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, REDACTED);
  return text;
}

export function sanitizeAuditDisplayValue(key: string, value: unknown): unknown {
  if (shouldRedactKey(key)) return REDACTED;

  if (typeof value === 'string') {
    return redactStringValue(value);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeAuditDisplayValue(`${key}[${index}]`, item));
  }

  if (value && typeof value === 'object') {
    return sanitizeAuditMetadataForDisplay(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeAuditMetadataForDisplay(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (shouldRedactKey(key)) continue;
    result[key] = sanitizeAuditDisplayValue(key, value);
  }
  return result;
}

export function isAuditAdmin(roles: string[], legacyRole?: string): boolean {
  return (
    roles.some((role) => ['company_admin', 'individual_admin'].includes(role)) ||
    legacyRole === 'admin'
  );
}

export function buildAuditEventsQuery(filters: {
  q?: string;
  type?: string;
  severity?: string;
  actorId?: string;
  from?: string;
  to?: string;
  documentId?: string;
  cursor?: string;
  category?: 'security';
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q?.trim()) params.q = filters.q.trim();
  if (filters.type?.trim()) params.type = filters.type.trim();
  if (filters.severity?.trim()) params.severity = filters.severity.trim();
  if (filters.actorId?.trim()) params.actorId = filters.actorId.trim();
  if (filters.from?.trim()) params.from = filters.from.trim();
  if (filters.to?.trim()) params.to = filters.to.trim();
  if (filters.documentId?.trim()) params.documentId = filters.documentId.trim();
  if (filters.cursor?.trim()) params.cursor = filters.cursor.trim();
  if (filters.category === 'security') params.category = 'security';
  return params;
}

export function dedupeAuditEvents(events: AuditEvent[]): AuditEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export type AuditTabId = 'pending' | 'events' | 'security' | 'all';

export function resolveEventFiltersForTab(
  tab: AuditTabId,
  baseFilters: AuditEventFilters,
): AuditEventFilters {
  if (tab === 'security') {
    return { ...baseFilters, category: 'security', type: undefined };
  }
  if (tab === 'all') {
    return {
      documentId: baseFilters.documentId,
      q: baseFilters.q,
      from: baseFilters.from,
      to: baseFilters.to,
      limit: baseFilters.limit,
    };
  }
  const { category, ...rest } = baseFilters;
  void category;
  return rest;
}
