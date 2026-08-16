import { createContext, useContext } from 'react';
import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import type { WorkflowReviewSettings } from '@/features/document-send/types/reviewWorkflowSettings';
import type { UploadContext, UploadQueueItem } from './types';

export type AutoConfirmCountdown = {
  itemId: string;
  secondsLeft: number;
};

export type UploadQueueContextValue = {
  items: UploadQueueItem[];
  pendingCount: number;
  reviewItemId: string | null;
  reviewSettings: WorkflowReviewSettings;
  autoConfirmCountdown: AutoConfirmCountdown | null;
  updateReviewSettings: (settings: WorkflowReviewSettings) => void;
  startUploadFromFiles: (files: File[], context?: UploadContext) => void;
  openReview: (itemId: string) => void;
  closeReview: () => void;
  confirmReview: (
    itemId: string,
    perItem?: PerItemNamingChoice,
    /** Categoria escolhida à mão quando a IA não classificou (ou quando quem revisa discorda). */
    manualClassId?: string,
  ) => Promise<void>;
  setItemNamingChoice: (itemId: string, choice: PerItemNamingChoice) => void;
  cancelAutoConfirm: (itemId: string) => void;
  retryItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearFinished: () => void;
};

export const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

export function useUploadQueueContext(): UploadQueueContextValue {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error('useUploadQueueContext deve ser usado dentro de UploadQueueProvider');
  }
  return context;
}
