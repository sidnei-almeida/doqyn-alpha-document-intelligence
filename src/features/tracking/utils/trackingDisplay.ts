import type { DocumentTrackingFilters } from '@/types/document-tracking';

export const TRACKING_CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'upload', label: 'Upload' },
  { value: 'analysis', label: 'Análise' },
  { value: 'edit', label: 'Edição' },
  { value: 'download', label: 'Download' },
  { value: 'preview', label: 'Preview' },
  { value: 'error', label: 'Erros' },
] as const;

export const TRACKING_SEVERITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Aviso' },
  { value: 'error', label: 'Erro' },
  { value: 'critical', label: 'Crítico' },
] as const;

export function buildTrackingEventsQuery(filters: DocumentTrackingFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.q?.trim()) params.q = filters.q.trim();
  if (filters.documentId?.trim()) params.documentId = filters.documentId.trim();
  if (filters.versionId?.trim()) params.versionId = filters.versionId.trim();
  if (filters.action?.trim()) params.action = filters.action.trim();
  if (filters.severity?.trim()) params.severity = filters.severity.trim();
  if (filters.actorUserId?.trim()) params.actorUserId = filters.actorUserId.trim();
  if (filters.from?.trim()) params.from = filters.from.trim();
  if (filters.to?.trim()) params.to = filters.to.trim();
  if (filters.category && filters.category !== 'all') params.category = filters.category;

  return params;
}

export function formatTrackingAction(action: string): string {
  return action
    .replace(/^document\./, '')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export { sanitizeAuditMetadataForDisplay as sanitizeTrackingMetadata } from '../../audit/utils/auditDisplay';
