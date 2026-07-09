import type { DocumentTrackingFilters, TrackingListStatus } from '@/types/document-tracking';

export const TRACKING_CATEGORY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'upload', label: 'Upload' },
  { value: 'analysis', label: 'Análise' },
  { value: 'edit', label: 'Edição' },
  { value: 'download', label: 'Download' },
  { value: 'preview', label: 'Preview' },
  { value: 'access', label: 'Acesso' },
  { value: 'error', label: 'Erros' },
] as const;

export const TRACKING_SEVERITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Aviso' },
  { value: 'error', label: 'Erro' },
  { value: 'critical', label: 'Crítico' },
] as const;

export const TRACKING_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'success', label: 'Sucesso' },
  { value: 'failed', label: 'Falha' },
  { value: 'denied', label: 'Negado' },
  { value: 'pending', label: 'Pendente' },
] as const;

export const TRACKING_ACTION_GROUP_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'lifecycle', label: 'Ciclo de vida' },
  { value: 'preview', label: 'Preview' },
  { value: 'download', label: 'Download' },
  { value: 'access', label: 'Acesso' },
  { value: 'storage', label: 'Storage' },
  { value: 'explorer', label: 'Explorador' },
  { value: 'governance', label: 'Governança' },
] as const;

const ACTION_LABELS: Record<string, string> = {
  'document.upload_started': 'Upload iniciado',
  'document.upload_completed': 'Upload concluído',
  'document.analysis_started': 'Análise iniciada',
  'document.analysis_completed': 'Análise concluída',
  'document.review_confirmed': 'Revisão confirmada',
  'document.preview_viewed': 'Preview visualizado',
  'document.preview_denied': 'Preview negado',
  'document.preview_failed': 'Falha no preview',
  'document.viewer_opened': 'Viewer aberto',
  'document.viewer_closed': 'Viewer fechado',
  'document.print_attempt_blocked': 'Impressão bloqueada',
  'document.download_attempted': 'Download tentado',
  'document.downloaded': 'Download realizado',
  'document.download_denied': 'Download negado',
  'document.metadata_updated': 'Metadados atualizados',
  'document.version_created': 'Nova versão criada',
  'access.document_denied': 'Acesso negado',
  'file_explorer.folder_opened': 'Pasta aberta',
  'file_explorer.search_performed': 'Busca realizada',
  'file_explorer.filter_applied': 'Filtro aplicado',
  'file_explorer.details_opened': 'Detalhes abertos',
};

const STATUS_LABELS: Record<TrackingListStatus, string> = {
  success: 'Sucesso',
  failed: 'Falha',
  denied: 'Negado',
  pending: 'Pendente',
};

export function buildTrackingEventsQuery(filters: DocumentTrackingFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.q?.trim()) params.q = filters.q.trim();
  if (filters.documentId?.trim()) params.documentId = filters.documentId.trim();
  if (filters.versionId?.trim()) params.versionId = filters.versionId.trim();
  if (filters.action?.trim()) params.action = filters.action.trim();
  if (filters.severity?.trim()) params.severity = filters.severity.trim();
  if (filters.status?.trim()) params.status = filters.status.trim();
  if (filters.actionGroup?.trim()) params.actionGroup = filters.actionGroup.trim();
  if (filters.requestId?.trim()) params.requestId = filters.requestId.trim();
  if (filters.actorUserId?.trim()) params.actorUserId = filters.actorUserId.trim();
  if (filters.from?.trim()) params.from = filters.from.trim();
  if (filters.to?.trim()) params.to = filters.to.trim();
  if (filters.category && filters.category !== 'all') params.category = filters.category;

  return params;
}

export function formatTrackingAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .replace(/^document\./, '')
    .replace(/^access\./, 'Acesso: ')
    .replace(/^file_explorer\./, 'Explorador: ')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatTrackingStatus(status?: TrackingListStatus): string {
  if (!status) return '—';
  return STATUS_LABELS[status] ?? status;
}

export function formatSessionOrigin(sessionHash?: string): string {
  if (!sessionHash) return '—';
  return `${sessionHash.slice(0, 8)}…`;
}

export { sanitizeAuditMetadataForDisplay as sanitizeTrackingMetadata } from '../../audit/utils/auditDisplay';
