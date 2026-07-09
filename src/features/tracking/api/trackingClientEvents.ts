import { postClientTrackingEvent } from './trackingApi';

const ALLOWED_CLIENT_ACTIONS = new Set([
  'document.viewer_opened',
  'document.viewer_closed',
  'document.print_attempt_blocked',
  'file_explorer.folder_opened',
  'file_explorer.search_performed',
  'file_explorer.filter_applied',
  'file_explorer.details_opened',
]);

/** Emite evento de tracking do cliente sem bloquear a UI. */
export function emitClientTrackingEvent(input: {
  action: string;
  documentId?: string;
  versionId?: string;
  metadata?: Record<string, unknown>;
}): void {
  if (!ALLOWED_CLIENT_ACTIONS.has(input.action)) return;

  void postClientTrackingEvent(input).catch(() => undefined);
}
