import type { UploadQueueItemStatus } from '../types';

export function uploadStatusProgress(status: UploadQueueItemStatus): number {
  switch (status) {
    case 'queued':
      return 12;
    case 'analyzing':
      return 48;
    case 'review':
      return 72;
    case 'confirming':
      return 88;
    case 'awaiting_approval':
      return 100;
    case 'ai_paused':
      return 100;
    case 'still_running':
      return 100;
    case 'done':
      return 100;
    case 'error':
      return 100;
    default:
      return 0;
  }
}

export function isUploadInProgress(status: UploadQueueItemStatus): boolean {
  return ['queued', 'analyzing', 'review', 'confirming'].includes(status);
}
