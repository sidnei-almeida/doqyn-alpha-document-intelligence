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
  'document.moved': 'Documento movido de categoria',
  'document.share_created': 'Compartilhamento criado',
  'document.share_revoked': 'Compartilhamento revogado',
  'document.external_share_created': 'Compartilhamento externo criado',
  'document.external_share_invite_opened': 'Convite externo aberto',
  'document.external_share_accepted': 'Convite externo aceito',
  'document.external_share_viewed': 'Documento externo visualizado',
  'document.external_share_downloaded': 'Download externo realizado',
  'document.external_share_revoked': 'Compartilhamento externo revogado',
  'document.external_share_expired': 'Compartilhamento externo expirado',
  'document.external_share_denied': 'Acesso externo negado',
  'document.signature_request_created': 'Solicitação de assinatura criada',
  'document.signature_internal_assigned': 'Assinatura atribuída a usuário interno',
  'document.signature_internal_opened': 'Assinatura interna aberta',
  'document.signature_external_invite_created': 'Convite externo de assinatura criado',
  'document.signature_external_opened': 'Assinatura externa aberta',
  'document.signature_link_opened': 'Link de assinatura aberto',
  'document.signature_preview_viewed': 'Preview para assinatura visualizado',
  'document.signature_viewed': 'Documento para assinatura visualizado',
  'document.signature_consent_checked': 'Aceite de assinatura registrado',
  'document.signature_completed': 'Assinatura eletrônica concluída',
  'document.signature_declined': 'Assinatura recusada',
  'document.signature_request_cancelled': 'Solicitação de assinatura revogada',
  'document.signature_downloaded': 'PDF assinado baixado',
  'document.signed_pdf_generated': 'PDF assinado gerado',
  'document.signature_verification_opened': 'Validação de assinatura aberta',
  'document.shared_viewed': 'Documento compartilhado visualizado',
  'document.shared_downloaded': 'Download de documento compartilhado',
  'document.share_denied': 'Compartilhamento negado',
  'document.version_created': 'Nova versão criada',
  'document.trash_moved': 'Movido para lixeira',
  'document.trash_restored': 'Restaurado da lixeira',
  'document.deactivated': 'Desativado após lixeira',
  'document.reactivated': 'Reativado',
  'document.permanent_deleted': 'Excluído permanentemente',
  'document.trash_purge_failed': 'Falha na purga de storage',
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

export type SecurityContextDisplay = {
  deviceLabel: string;
  deviceTypeLabel: string;
  locationLabel: string;
  ipLabel: string;
  sessionLabel: string;
  occurredAtLabel?: string;
  isExternalGuest: boolean;
};

function formatDeviceTypeLabel(deviceType?: unknown): string {
  switch (deviceType) {
    case 'mobile':
      return 'Mobile';
    case 'tablet':
      return 'Tablet';
    case 'desktop':
      return 'Desktop';
    default:
      return 'Desconhecido';
  }
}

export function formatSecurityContextDisplay(
  securityContext?: Record<string, unknown> | null,
  occurredAt?: string,
): SecurityContextDisplay | null {
  if (!securityContext || Object.keys(securityContext).length === 0) return null;

  const browser = typeof securityContext.browser === 'string' ? securityContext.browser : undefined;
  const os = typeof securityContext.os === 'string' ? securityContext.os : undefined;
  const summary =
    typeof securityContext.userAgent === 'string'
      ? securityContext.userAgent
      : [browser, os].filter(Boolean).join(' em ');

  const city = typeof securityContext.city === 'string' ? securityContext.city : undefined;
  const region = typeof securityContext.region === 'string' ? securityContext.region : undefined;
  const country = typeof securityContext.country === 'string' ? securityContext.country : undefined;
  const locationParts = [city, region, country].filter(Boolean);
  const ipLabel =
    typeof securityContext.ipAddressMasked === 'string'
      ? securityContext.ipAddressMasked
      : '—';
  const isLocalNetwork =
    securityContext.isLocalNetwork === true ||
    ipLabel === 'rede local' ||
    ipLabel === '1:…';

  return {
    deviceLabel: summary || '—',
    deviceTypeLabel: formatDeviceTypeLabel(securityContext.deviceType),
    locationLabel: isLocalNetwork
      ? 'Rede local'
      : locationParts.length
        ? locationParts.join(', ')
        : '—',
    ipLabel,
    sessionLabel: formatSessionOrigin(
      typeof securityContext.sessionIdHash === 'string'
        ? securityContext.sessionIdHash
        : undefined,
    ),
    occurredAtLabel: occurredAt,
    isExternalGuest: securityContext.isExternalGuest === true,
  };
}

export { sanitizeAuditMetadataForDisplay as sanitizeTrackingMetadata } from '../../audit/utils/auditDisplay';
