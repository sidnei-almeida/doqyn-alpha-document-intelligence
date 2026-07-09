/** Grupos de ação para filtros e agregações de tracking. */
export type TrackingActionGroup =
  | 'lifecycle'
  | 'preview'
  | 'download'
  | 'access'
  | 'storage'
  | 'governance'
  | 'explorer'
  | 'user'
  | 'system';

export type TrackingEventStatus = 'success' | 'failed' | 'denied' | 'pending';

/** Eventos que o frontend pode emitir via POST /api/tracking/client-event. */
export const CLIENT_TRACKING_ACTIONS = new Set([
  'document.viewer_opened',
  'document.viewer_closed',
  'document.print_attempt_blocked',
  'file_explorer.folder_opened',
  'file_explorer.search_performed',
  'file_explorer.filter_applied',
  'file_explorer.details_opened',
]);

const ACTION_GROUP_RULES: Array<{ prefix: string; group: TrackingActionGroup }> = [
  { prefix: 'access.', group: 'access' },
  { prefix: 'storage.', group: 'storage' },
  { prefix: 'governance.', group: 'governance' },
  { prefix: 'file_explorer.', group: 'explorer' },
  { prefix: 'user.', group: 'user' },
  { prefix: 'tenant.', group: 'system' },
  { prefix: 'document.preview_', group: 'preview' },
  { prefix: 'document.viewer_', group: 'preview' },
  { prefix: 'document.download', group: 'download' },
  { prefix: 'document.upload_', group: 'lifecycle' },
  { prefix: 'document.analysis_', group: 'lifecycle' },
  { prefix: 'document.review_', group: 'lifecycle' },
  { prefix: 'document.version_', group: 'lifecycle' },
  { prefix: 'document.metadata_', group: 'lifecycle' },
  { prefix: 'document.filename_', group: 'lifecycle' },
  { prefix: 'document.category_', group: 'lifecycle' },
  { prefix: 'document.status_', group: 'lifecycle' },
  { prefix: 'document.trash_', group: 'lifecycle' },
  { prefix: 'document.permanent_', group: 'lifecycle' },
  { prefix: 'document.archived', group: 'lifecycle' },
  { prefix: 'document.restored', group: 'lifecycle' },
  { prefix: 'document.deleted', group: 'lifecycle' },
  { prefix: 'document.created', group: 'lifecycle' },
  { prefix: 'document.storage_', group: 'storage' },
  { prefix: 'document.', group: 'lifecycle' },
];

export function resolveTrackingActionGroup(action: string): TrackingActionGroup {
  for (const rule of ACTION_GROUP_RULES) {
    if (action.startsWith(rule.prefix)) return rule.group;
  }
  return 'system';
}

export function resolveTrackingEventStatus(
  action: string,
  result?: string,
): TrackingEventStatus {
  if (action.includes('denied') || result === 'denied') return 'denied';
  if (action.includes('failed') || result === 'error') return 'failed';
  if (action.includes('pending') || result === 'pending') return 'pending';
  return 'success';
}

export const TRACKING_RETENTION_DAYS_DEFAULT = 365;
export const TRACKING_HIGH_VOLUME_RETENTION_DAYS_DEFAULT = 90;
