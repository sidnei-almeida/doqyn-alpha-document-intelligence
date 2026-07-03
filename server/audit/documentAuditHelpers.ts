import type { DocumentAuditChange } from './documentAuditTypes.js';

export function buildAuditChangeSet(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  allowedFields: string[],
): DocumentAuditChange[] {
  const changes: DocumentAuditChange[] = [];

  for (const field of allowedFields) {
    const prev = before?.[field];
    const next = after?.[field];
    const same =
      prev === next ||
      (prev instanceof Date && next instanceof Date && prev.getTime() === next.getTime()) ||
      JSON.stringify(prev ?? null) === JSON.stringify(next ?? null);

    if (!same) {
      changes.push({ field, before: prev ?? null, after: next ?? null });
    }
  }

  return changes;
}

export function summarizeAuditAction(action: string, description: string): string {
  return description.trim() || action;
}
