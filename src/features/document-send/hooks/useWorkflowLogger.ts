import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  WorkflowLogEvent,
  WorkflowLogFilter,
  WorkflowLogInput,
  WorkflowLogLevel,
} from '../types/workflowLog';
import {
  WORKFLOW_LOG_MAX_EVENTS,
  normalizeWorkflowEvent,
} from '../utils/workflowLogHelpers';

export type WorkflowLoggerApi = {
  events: WorkflowLogEvent[];
  currentBatchId: string | null;
  selectedItemId: string | null;
  setSelectedItemId: (itemId: string | null) => void;
  setCurrentBatchId: (batchId: string | null) => void;
  log: (event: WorkflowLogInput) => WorkflowLogEvent;
  logItem: (
    itemId: string,
    fileName: string | undefined,
    event: Omit<WorkflowLogInput, 'itemId' | 'fileName' | 'batchId'>,
  ) => WorkflowLogEvent;
  logBatch: (
    event: Omit<WorkflowLogInput, 'batchId'>,
  ) => WorkflowLogEvent;
  logDebug: (
    event: Omit<WorkflowLogInput, 'level'>,
  ) => WorkflowLogEvent;
  clearLogs: () => void;
  getLogsByItem: (itemId: string) => WorkflowLogEvent[];
  getBatchLogs: (batchId: string) => WorkflowLogEvent[];
  filterEvents: (options: {
    filter?: WorkflowLogFilter;
    itemId?: string | null;
    batchId?: string | null;
    showDebug?: boolean;
  }) => WorkflowLogEvent[];
};

function isReviewEvent(event: WorkflowLogEvent): boolean {
  return (
    event.stage === 'review' ||
    event.message.toLowerCase().includes('revisão') ||
    event.message.toLowerCase().includes('não classific')
  );
}

function isSavedEvent(event: WorkflowLogEvent): boolean {
  return (
    event.level === 'success' &&
    (event.stage === 'persistence' ||
      event.message.toLowerCase().includes('salvo'))
  );
}

export function useWorkflowLogger(): WorkflowLoggerApi {
  const [events, setEvents] = useState<WorkflowLogEvent[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const batchIdRef = useRef<string | null>(null);

  const appendEvent = useCallback((input: WorkflowLogInput): WorkflowLogEvent => {
    const normalized = normalizeWorkflowEvent({
      ...input,
      batchId: input.batchId ?? batchIdRef.current ?? undefined,
    });

    if (normalized.level === 'debug' && import.meta.env.DEV) {
      console.debug('[workflow]', normalized.message, normalized.details ?? '');
    }

    setEvents((prev) => {
      const next = [...prev, normalized];
      if (next.length <= WORKFLOW_LOG_MAX_EVENTS) return next;
      return next.slice(next.length - WORKFLOW_LOG_MAX_EVENTS);
    });

    return normalized;
  }, []);

  const setBatchId = useCallback((batchId: string | null) => {
    batchIdRef.current = batchId;
    setCurrentBatchId(batchId);
  }, []);

  const log = useCallback(
    (event: WorkflowLogInput) => appendEvent(event),
    [appendEvent],
  );

  const logItem = useCallback(
    (
      itemId: string,
      fileName: string | undefined,
      event: Omit<WorkflowLogInput, 'itemId' | 'fileName' | 'batchId'>,
    ) =>
      appendEvent({
        ...event,
        itemId,
        fileName,
      }),
    [appendEvent],
  );

  const logBatch = useCallback(
    (event: Omit<WorkflowLogInput, 'batchId'>) => appendEvent(event),
    [appendEvent],
  );

  const logDebug = useCallback(
    (event: Omit<WorkflowLogInput, 'level'>) =>
      appendEvent({ ...event, level: 'debug' }),
    [appendEvent],
  );

  const clearLogs = useCallback(() => {
    setEvents([]);
    setSelectedItemId(null);
  }, []);

  const getLogsByItem = useCallback(
    (itemId: string) => events.filter((event) => event.itemId === itemId),
    [events],
  );

  const getBatchLogs = useCallback(
    (batchId: string) => events.filter((event) => event.batchId === batchId),
    [events],
  );

  const filterEvents = useCallback(
    ({
      filter = 'all',
      itemId = null,
      batchId = null,
      showDebug = false,
    }: {
      filter?: WorkflowLogFilter;
      itemId?: string | null;
      batchId?: string | null;
      showDebug?: boolean;
    }) => {
      let filtered = events;

      if (batchId) {
        filtered = filtered.filter((event) => event.batchId === batchId);
      }

      if (!showDebug) {
        filtered = filtered.filter((event) => event.level !== 'debug');
      }

      if (filter === 'errors') {
        filtered = filtered.filter((event) => event.level === 'error');
      } else if (filter === 'review') {
        filtered = filtered.filter(isReviewEvent);
      } else if (filter === 'saved') {
        filtered = filtered.filter(isSavedEvent);
      } else if (filter === 'current' && itemId) {
        filtered = filtered.filter((event) => event.itemId === itemId);
      }

      return filtered;
    },
    [events],
  );

  return useMemo(
    () => ({
      events,
      currentBatchId,
      selectedItemId,
      setSelectedItemId,
      setCurrentBatchId: setBatchId,
      log,
      logItem,
      logBatch,
      logDebug,
      clearLogs,
      getLogsByItem,
      getBatchLogs,
      filterEvents,
    }),
    [
      events,
      currentBatchId,
      selectedItemId,
      setBatchId,
      log,
      logItem,
      logBatch,
      logDebug,
      clearLogs,
      getLogsByItem,
      getBatchLogs,
      filterEvents,
    ],
  );
}

export function levelLabel(level: WorkflowLogLevel): string {
  switch (level) {
    case 'success':
      return 'Sucesso';
    case 'warning':
      return 'Atenção';
    case 'error':
      return 'Erro';
    case 'debug':
      return 'Debug';
    default:
      return 'Info';
  }
}
