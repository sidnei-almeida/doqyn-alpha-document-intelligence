import { useCallback, useEffect, useRef, useState } from 'react';
import { generateDocumentId } from '../mockData';
import { analyzePdf, AnalyzePdfRequestError } from '../services/analyzePdf';
import { confirmAnalysis } from '../services/confirmAnalysis';
import { BULK_NEXT_ITEM_DELAY_MS } from '../uploadConstants';
import type { WorkflowLoggerApi } from '../hooks/useWorkflowLogger';
import type { BulkBatchPhase, BulkUploadItem, BulkUploadItemStatus } from '../types/bulk';
import {
  buildAnalysisDecision,
  createBatchId,
  createRequestId,
  formatDurationMs,
  mapProcessingLogsToWorkflowEvents,
} from '../utils/workflowLogHelpers';
import {
  canBulkManualConfirm,
  getAnalysisClassificationError,
  getBulkAutoSaveBlockers,
  getBulkReviewReason,
  resolveBulkItemStatusAfterAnalysis,
} from '../utils/bulkEligibility';
import {
  buildIsolationSnapshot,
  hasOtherInFlightItem,
  validateAnalysisResponseOwnership,
  type ActiveAnalysisRequest,
} from '../utils/bulkQueueIsolation';
import {
  isNonExtractablePdfError,
  NON_EXTRACTABLE_TEXT_MESSAGE,
  validateBulkQueueFile,
} from '../utils/bulkFileValidation';
import {
  buildWorkflowErrorLogDetails,
  parseWorkflowErrorPayload,
} from '../utils/workflowErrors';

const IN_FLIGHT_STATUSES: BulkUploadItemStatus[] = ['analyzing', 'saving', 'auto_countdown'];

function formatNow(): string {
  const now = new Date();
  return `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isInFlightStatus(status: BulkUploadItemStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

export type BulkHistoryPayload = {
  item: BulkUploadItem;
  autoSaved: boolean;
};

export type BulkTerminalPayload = {
  item: BulkUploadItem;
  autoSaved?: boolean;
};

type UseBulkUploadQueueOptions = {
  autoMode: boolean;
  autoDelaySeconds: number;
  isAuthenticated: boolean;
  workflow: WorkflowLoggerApi;
  onItemSaved: (payload: BulkHistoryPayload) => void;
  onItemTerminal?: (payload: BulkTerminalPayload) => void;
};

type CountdownHandle = {
  cancel: () => void;
  completed: Promise<boolean>;
};

function startCountdownSeconds(
  seconds: number,
  onTick: (remaining: number) => void,
  shouldContinue: () => boolean,
): CountdownHandle {
  let remaining = seconds;
  let intervalId: number | null = null;
  let resolveCompleted: (value: boolean) => void = () => undefined;

  const completed = new Promise<boolean>((resolve) => {
    resolveCompleted = resolve;
  });

  const cancel = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    resolveCompleted(false);
  };

  if (!shouldContinue()) {
    resolveCompleted(false);
    return { cancel, completed: Promise.resolve(false) };
  }

  onTick(remaining);

  intervalId = window.setInterval(() => {
    if (!shouldContinue()) {
      cancel();
      return;
    }

    remaining -= 1;
    if (remaining <= 0) {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      onTick(0);
      resolveCompleted(true);
      return;
    }

    onTick(remaining);
  }, 1000);

  return { cancel, completed };
}

export function useBulkUploadQueue({
  autoMode,
  autoDelaySeconds,
  isAuthenticated,
  workflow,
  onItemSaved,
  onItemTerminal,
}: UseBulkUploadQueueOptions) {
  const [items, setItems] = useState<BulkUploadItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchPhase, setBatchPhase] = useState<BulkBatchPhase>('idle');
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [manualGate, setManualGate] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const itemsRef = useRef(items);
  const batchPhaseRef = useRef(batchPhase);
  const batchIdRef = useRef<string | null>(null);
  const isQueueWorkerRunningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const workerRunIdRef = useRef(0);
  const batchStartedAtRef = useRef<number | null>(null);
  const itemStartedAtRef = useRef<Map<string, number>>(new Map());
  const manualGateRef = useRef(manualGate);
  const currentItemIdRef = useRef<string | null>(null);
  const autoModeRef = useRef(autoMode);
  const autoDelaySecondsRef = useRef(autoDelaySeconds);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const countdownHandleRef = useRef<CountdownHandle | null>(null);
  const countdownItemIdRef = useRef<string | null>(null);
  const activeAnalysisRequestRef = useRef<ActiveAnalysisRequest | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    batchPhaseRef.current = batchPhase;
  }, [batchPhase]);

  useEffect(() => {
    batchIdRef.current = batchId;
  }, [batchId]);

  useEffect(() => {
    manualGateRef.current = manualGate;
  }, [manualGate]);

  useEffect(() => {
    currentItemIdRef.current = currentItemId;
  }, [currentItemId]);

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

  useEffect(() => {
    autoDelaySecondsRef.current = autoDelaySeconds;
  }, [autoDelaySeconds]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const appendItemMessage = useCallback((id: string, message: string) => {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, logs: [...item.logs, message] } : item,
      );
      itemsRef.current = next;
      return next;
    });
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<BulkUploadItem>) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      itemsRef.current = next;
      return next;
    });
  }, []);

  const getItemById = useCallback((itemId: string): BulkUploadItem | undefined => {
    return itemsRef.current.find((item) => item.id === itemId);
  }, []);

  const getIsolationSnapshot = useCallback(() => {
    return buildIsolationSnapshot({
      items: itemsRef.current,
      batchId: batchIdRef.current,
      currentItemId: currentItemIdRef.current,
      activeAnalysisRequest: activeAnalysisRequestRef.current,
      hasAbortController: abortRef.current !== null,
      countdownItemId: countdownItemIdRef.current,
      hasActiveCountdown: countdownHandleRef.current !== null,
      workerRunning: isQueueWorkerRunningRef.current,
    });
  }, []);

  const logIsolationSnapshot = useCallback(
    (message: string, itemId?: string, fileName?: string, extra?: Record<string, unknown>) => {
      const snapshot = getIsolationSnapshot();
      workflow.logBatch({
        level: 'info',
        stage: 'queue',
        message,
        details: {
          ...snapshot,
          ...extra,
        },
      });
      if (itemId) {
        workflow.logItem(itemId, fileName, {
          level: 'debug',
          stage: 'queue',
          message,
          details: { ...snapshot, ...extra },
        });
      }
    },
    [getIsolationSnapshot, workflow],
  );

  const cancelCurrentCountdown = useCallback(
    (reason: string, fileName?: string) => {
      if (countdownHandleRef.current && countdownItemIdRef.current) {
        workflow.logItem(countdownItemIdRef.current, fileName, {
          level: 'warning',
          stage: 'auto',
          message: `Countdown cancelado para item ${countdownItemIdRef.current}.`,
          details: { reason },
        });
      }
      countdownHandleRef.current?.cancel();
      countdownHandleRef.current = null;
      countdownItemIdRef.current = null;
      setAutoCountdown(null);
    },
    [workflow],
  );

  const resetCurrentProcessingState = useCallback(
    (reason: string, options?: { logTransition?: boolean }) => {
      const before = getIsolationSnapshot();

      cancelCurrentCountdown(reason);
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = null;
      activeAnalysisRequestRef.current = null;
      setAutoCountdown(null);
      setStatusMessage(null);

      if (options?.logTransition) {
        const after = getIsolationSnapshot();
        workflow.logBatch({
          level: 'info',
          stage: 'queue',
          message: 'Estado temporário limpo. Preparando próximo item.',
          details: {
            reason,
            itemFinalizado: before.currentItemId,
            statusFinal: before.currentItemId
              ? itemsRef.current.find((item) => item.id === before.currentItemId)?.status
              : undefined,
            before,
            after,
            currentResultLimpo: !after.currentItemHasResult || !after.currentItemId,
            currentFileLimpo: !after.currentItemHasFile || !after.currentItemId,
            countdownLimpo: !after.hasActiveCountdown,
            abortControllerLimpo: !after.hasAbortController,
            timersAtivos: after.hasActiveCountdown ? 1 : 0,
            proximoItem: itemsRef.current.find((item) => item.status === 'queued')?.id ?? null,
          },
        });
      }
    },
    [cancelCurrentCountdown, getIsolationSnapshot, workflow],
  );

  const canApplyToItem = useCallback(
    (itemId: string, workerRunId: number, expectedStatuses?: BulkUploadItemStatus[]): boolean => {
      if (workerRunId !== workerRunIdRef.current) return false;
      if (runIdRef.current !== workerRunId) return false;
      if (batchPhaseRef.current !== 'running') return false;

      const item = getItemById(itemId);
      if (!item) {
        workflow.logBatch({
          level: 'warning',
          stage: 'queue',
          message: `Resposta descartada: item ${itemId} não existe na fila.`,
        });
        return false;
      }

      if (currentItemIdRef.current !== itemId) {
        workflow.logBatch({
          level: 'warning',
          stage: 'queue',
          message: `Resposta descartada: item ${itemId} não é o item atual.`,
          details: { currentItemId: currentItemIdRef.current },
        });
        return false;
      }

      if (expectedStatuses && !expectedStatuses.includes(item.status)) {
        workflow.logBatch({
          level: 'warning',
          stage: 'queue',
          message: `Resposta descartada: status inesperado para item ${itemId}.`,
          details: { status: item.status, expectedStatuses },
        });
        return false;
      }

      return true;
    },
    [getItemById, workflow],
  );

  const finishQueueItem = useCallback(
    (itemId: string, autoSaved?: boolean) => {
      const item = getItemById(itemId);
      if (!item) return;

      const startedAt = itemStartedAtRef.current.get(itemId);
      const durationMs = startedAt ? Date.now() - startedAt : undefined;

      workflow.logItem(itemId, item.originalFileName, {
        level:
          item.status === 'saved'
            ? 'success'
            : item.status === 'error'
              ? 'error'
              : item.status === 'skipped'
                ? 'warning'
                : 'info',
        stage: item.status === 'saved' ? 'persistence' : item.status === 'error' ? 'error' : 'queue',
        message: `Item finalizado com status ${item.status}.`,
        details: durationMs ? { durationMs, finalStatus: item.status } : { finalStatus: item.status },
      });

      itemStartedAtRef.current.delete(itemId);
      onItemTerminal?.({ item, autoSaved });
      resetCurrentProcessingState(`item finalizado: ${item.status}`, { logTransition: true });
      setCurrentItemId(null);
      currentItemIdRef.current = null;
    },
    [getItemById, onItemTerminal, resetCurrentProcessingState, workflow],
  );

  const markItemReview = useCallback(
    (itemId: string, reason: string) => {
      patchItem(itemId, {
        status: 'requires_review',
        errorMessage: undefined,
        finishedAt: formatNow(),
      });

      workflow.logItem(itemId, getItemById(itemId)?.originalFileName, {
        level: 'warning',
        stage: 'review',
        message: 'Documento requer revisão.',
        details: { reason },
      });
      appendItemMessage(itemId, reason);
      finishQueueItem(itemId);
    },
    [appendItemMessage, finishQueueItem, getItemById, patchItem, workflow],
  );

  const markItemAnalysisError = useCallback(
    (
      itemId: string,
      message: string,
      details?: Record<string, unknown>,
      options?: { toastMessage?: string },
    ) => {
      patchItem(itemId, {
        status: 'error',
        errorMessage: message,
        finishedAt: formatNow(),
      });
      workflow.logItem(itemId, getItemById(itemId)?.originalFileName, {
        level: 'error',
        stage: 'error',
        message: typeof details?.friendlyTitle === 'string' ? details.friendlyTitle : message,
        details,
      });
      appendItemMessage(itemId, options?.toastMessage ?? message);
      finishQueueItem(itemId);
    },
    [appendItemMessage, finishQueueItem, getItemById, patchItem, workflow],
  );

  const createQueueItem = useCallback(
    (file: File, status: BulkUploadItemStatus = 'queued', errorMessage?: string): BulkUploadItem => ({
      id: generateDocumentId(),
      file,
      originalFileName: file.name,
      sizeBytes: file.size,
      status,
      errorMessage,
      logs: errorMessage ? [errorMessage] : [],
    }),
    [],
  );

  const tryCompleteBatch = useCallback(() => {
    const snapshot = itemsRef.current;
    const hasQueued = snapshot.some((item) => item.status === 'queued');
    const hasInFlight = snapshot.some((item) => isInFlightStatus(item.status));
    const waitingManual = snapshot.some((item) => item.status === 'analyzed');

    if (hasQueued || hasInFlight || waitingManual || manualGateRef.current) {
      return;
    }

    setBatchPhase('completed');
    batchPhaseRef.current = 'completed';
    const batchDurationMs = batchStartedAtRef.current
      ? Date.now() - batchStartedAtRef.current
      : undefined;
    const stats = {
      total: snapshot.length,
      saved: snapshot.filter((i) => i.status === 'saved').length,
      review: snapshot.filter((i) => i.status === 'requires_review').length,
      errors: snapshot.filter((i) => i.status === 'error').length,
      skipped: snapshot.filter((i) => i.status === 'skipped').length,
    };
    workflow.logBatch({
      level: 'success',
      stage: 'queue',
      message: 'Lote concluído.',
      details: { ...stats, durationMs: batchDurationMs },
    });
    setStatusMessage(null);
    resetCurrentProcessingState('lote concluído', { logTransition: true });
    setCurrentItemId(null);
    currentItemIdRef.current = null;
  }, [resetCurrentProcessingState, workflow]);

  const saveItem = useCallback(
    async (itemId: string, autoSaved: boolean, workerRunId: number): Promise<boolean> => {
      const item = getItemById(itemId);
      if (!item?.result) return false;

      if (!canApplyToItem(itemId, workerRunId, ['analyzed', 'auto_countdown', 'saving', 'requires_review'])) {
        return false;
      }

      patchItem(itemId, { status: 'saving' });
      setStatusMessage('Salvando documento...');

      workflow.logItem(itemId, item.originalFileName, {
        level: 'info',
        stage: 'confirmation',
        message: `Confirmação iniciada para item ${itemId}.`,
        details: { autoSaved },
      });

      const confirmStartedAt = Date.now();
      const resultPayload = item.result;

      try {
        const result = await confirmAnalysis(resultPayload, {
          manualReviewConfirmed:
            item.metadata?.analysisStatus === 'requires_review' ||
            resultPayload.status === 'requires_review',
          context: {
            batchId: batchIdRef.current ?? undefined,
            itemId,
            fileName: item.originalFileName,
            requestId: createRequestId(),
          },
        });

        if (!canApplyToItem(itemId, workerRunId, ['saving'])) {
          return false;
        }

        const confirmDurationMs = Date.now() - confirmStartedAt;
        const finalFileName = resultPayload.recommendedFileName ?? item.recommendedFileName ?? '';

        patchItem(itemId, {
          status: 'saved',
          documentId: result.documentId,
          versionId: result.versionId,
          finalFileName,
          finishedAt: formatNow(),
        });

        workflow.logItem(itemId, item.originalFileName, {
          level: 'success',
          stage: 'persistence',
          message: `Documento salvo para item ${itemId}.`,
          details: {
            documentId: result.documentId,
            versionId: result.versionId,
            storageStatus: result.storageStatus,
            httpStatus: result.httpStatus,
            durationMs: confirmDurationMs,
            requestId: result.requestId,
            autoSaved,
          },
        });

        appendItemMessage(itemId, `Documento salvo como ${finalFileName}`);

        const savedItem = getItemById(itemId);
        if (savedItem) {
          onItemSaved({ item: savedItem, autoSaved });
          finishQueueItem(itemId, autoSaved);
        }
        return true;
      } catch (error) {
        if (!canApplyToItem(itemId, workerRunId)) {
          return false;
        }

        const message = error instanceof Error ? error.message : 'Não foi possível salvar o documento.';
        patchItem(itemId, {
          status: 'error',
          errorMessage: message,
          finishedAt: formatNow(),
        });

        workflow.logItem(itemId, item.originalFileName, {
          level: 'error',
          stage: 'persistence',
          message,
          details: { durationMs: Date.now() - confirmStartedAt },
        });

        appendItemMessage(itemId, message);
        finishQueueItem(itemId);
        return false;
      }
    },
    [appendItemMessage, canApplyToItem, finishQueueItem, getItemById, onItemSaved, patchItem, workflow],
  );

  const processSingleItem = useCallback(
    async (itemId: string, workerRunId: number): Promise<'continue' | 'break' | 'manual'> => {
      const next = getItemById(itemId);
      if (!next || next.status !== 'queued') {
        return 'continue';
      }

      const inFlight = hasOtherInFlightItem(itemsRef.current, next.id);
      if (inFlight) {
        logIsolationSnapshot(
          'Estado anterior verificado: outro item ainda em andamento.',
          next.id,
          next.originalFileName,
        );
        return 'break';
      }

      const queueIndex = itemsRef.current.findIndex((item) => item.id === next.id);
      const previousStatus = next.status;

      logIsolationSnapshot('Iniciando item isolado. Verificando estado anterior antes da análise.', next.id, next.originalFileName, {
        batchId: batchIdRef.current,
        itemId: next.id,
        fileName: next.originalFileName,
        queueIndex,
        previousStatus,
        newStatus: 'analyzing',
        outroItemEmAndamento: inFlight,
        countdownAtivo: countdownHandleRef.current !== null,
        abortControllerAnterior: abortRef.current !== null,
      });

      resetCurrentProcessingState('iniciar item isolado');

      setCurrentItemId(next.id);
      currentItemIdRef.current = next.id;
      workflow.setSelectedItemId(next.id);
      setStatusMessage('Análise iniciada');
      itemStartedAtRef.current.set(next.id, Date.now());
      patchItem(next.id, { status: 'analyzing', startedAt: formatNow() });

      workflow.logBatch({
        level: 'info',
        stage: 'queue',
        message: `Próximo documento selecionado: ${next.originalFileName}`,
        details: { itemId: next.id, queueIndex },
      });

      const controller = new AbortController();
      abortRef.current = controller;

      const requestId = createRequestId();
      const inFlightCounts = getIsolationSnapshot().inFlight;
      const fileCheck = validateBulkQueueFile(next.file);

      workflow.logItem(next.id, next.originalFileName, {
        level: 'info',
        stage: 'validation',
        message: 'Validando arquivo antes do envio.',
        details: {
          itemId: next.id,
          fileName: next.file.name,
          fileSize: next.file.size,
          fileType: next.file.type,
          isFileInstance: next.file instanceof File,
          fileValido: fileCheck.valid,
        },
      });

      if (!fileCheck.valid) {
        markItemAnalysisError(next.id, fileCheck.reason ?? 'Arquivo inválido no item da fila.', {
          tipo: 'arquivo_invalido',
        });
        return 'continue';
      }

      workflow.logItem(next.id, next.originalFileName, {
        level: 'info',
        stage: 'analysis',
        message: 'Chamando análise para item atual.',
        details: {
          itemId: next.id,
          fileName: next.originalFileName,
          requestId,
          batchId: batchIdRef.current,
          workerAtivo: isQueueWorkerRunningRef.current,
          analyzing: inFlightCounts.analyzing,
          saving: inFlightCounts.saving,
          auto_countdown: inFlightCounts.auto_countdown,
          timersAtivos: countdownHandleRef.current ? 1 : 0,
        },
      });

      activeAnalysisRequestRef.current = {
        itemId: next.id,
        fileName: next.originalFileName,
        requestId,
        batchId: batchIdRef.current,
      };

      workflow.logItem(next.id, next.originalFileName, {
        level: 'info',
        stage: 'analysis',
        message: 'Análise enviada.',
        details: { requestId, batchId: batchIdRef.current, itemId: next.id },
      });

      try {
        const response = await analyzePdf(next.file, {
          signal: controller.signal,
          context: {
            batchId: batchIdRef.current ?? undefined,
            itemId: next.id,
            fileName: next.originalFileName,
            requestId,
          },
        });

        workflow.logItem(next.id, next.originalFileName, {
          level: 'info',
          stage: 'analysis',
          message: 'Resposta recebida. Validando se pertence ao item atual.',
          details: {
            itemIdEsperado: next.id,
            itemIdAtual: currentItemIdRef.current,
            requestId,
            fileNameEsperado: next.originalFileName,
            fileNameRetornado: response.raw.originalFileName,
            className: response.raw.classification.className,
            classId: response.raw.classification.classId,
            confidence: response.raw.classification.confidence,
            requiresReview: response.raw.classification.requiresReview,
            recommendedFileName: response.raw.recommendedFileName,
            textCharCount: response.raw.textExtraction.charCount,
            pageCount: response.raw.textExtraction.pageCount,
            durationMs: response.durationMs,
          },
        });

        const ownership = validateAnalysisResponseOwnership({
          expectedItemId: next.id,
          expectedFileName: next.originalFileName,
          expectedRequestId: requestId,
          currentItemId: currentItemIdRef.current,
          activeRequest: activeAnalysisRequestRef.current,
          raw: response.raw,
          responseRequestId: response.requestId,
        });

        if (!ownership.belongsToItem || !canApplyToItem(next.id, workerRunId, ['analyzing'])) {
          workflow.logItem(next.id, next.originalFileName, {
            level: 'error',
            stage: 'error',
            message: 'Resposta descartada: não pertence ao item atual.',
            details: { reasons: ownership.reasons },
          });
          markItemAnalysisError(
            next.id,
            'Erro de fila: resposta de análise recebida fora do item atual.',
            { reasons: ownership.reasons },
          );
          activeAnalysisRequestRef.current = null;
          return 'continue';
        }

        activeAnalysisRequestRef.current = null;

        const { metadata, raw } = response;

        workflow.logItem(next.id, next.originalFileName, {
          level: 'success',
          stage: 'analysis',
          message: 'Resposta validada contra item atual.',
          details: {
            httpStatus: response.httpStatus,
            durationMs: response.durationMs,
            requestId: response.requestId,
            jobId: raw.jobId,
            pertenceAoItem: true,
          },
        });

        for (const mapped of mapProcessingLogsToWorkflowEvents(response.logs, {
          batchId: batchIdRef.current ?? undefined,
          itemId: next.id,
          fileName: next.originalFileName,
        })) {
          workflow.log(mapped);
          appendItemMessage(next.id, mapped.message);
        }

        const classificationError = getAnalysisClassificationError(raw, metadata);
        const postStatus = resolveBulkItemStatusAfterAnalysis(metadata, raw);
        const autoSaveBlockers = getBulkAutoSaveBlockers({
          isAuthenticated: isAuthenticatedRef.current,
          metadata,
          rawAnalysis: raw,
        });
        const autoEligible = autoSaveBlockers.length === 0;
        const recommendedFileName = raw.recommendedFileName ?? undefined;
        const className = raw.classification.className ?? metadata.documentType;
        const decision = buildAnalysisDecision(raw, metadata);

        workflow.logItem(next.id, next.originalFileName, {
          level: 'info',
          stage: 'classification',
          message: 'Decisão tomada.',
          details: {
            postStatus,
            decision: decision.action,
            reasons: decision.reasons,
            autoEligible,
            blockers: autoSaveBlockers,
          },
        });

        if (classificationError && postStatus === 'error') {
          markItemAnalysisError(next.id, classificationError, {
            classId: raw.classification.classId,
            className: raw.classification.className,
            confidence: raw.classification.confidence,
          });
          return 'continue';
        }

        if (postStatus === 'ai_paused') {
          const aiMessage =
            classificationError ??
            'Limite temporário da análise automática atingido. Aguarde alguns minutos e tente novamente.';

          patchItem(next.id, {
            status: 'ai_paused',
            result: raw,
            metadata,
            errorMessage: aiMessage,
            finishedAt: formatNow(),
          });

          appendItemMessage(next.id, aiMessage);

          workflow.logItem(next.id, next.originalFileName, {
            level: 'warning',
            stage: 'analysis',
            message:
              'Análise automática temporariamente limitada. Lote pausado para evitar novas falhas.',
            details: { errorCode: 'GROQ_RATE_LIMIT' },
          });

          workflow.log({
            level: 'warning',
            stage: 'auto',
            message:
              'Análise automática temporariamente limitada. Lote pausado para evitar novas falhas.',
          });

          setBatchPhase('paused');
          batchPhaseRef.current = 'paused';
          setStatusMessage('IA temporariamente indisponível — retome depois');
          setManualGate(true);
          manualGateRef.current = true;
          return 'manual';
        }

        patchItem(next.id, {
          status: postStatus,
          result: raw,
          metadata,
          recommendedFileName,
          finalFileName: recommendedFileName,
          className,
          confidence: raw.classification.confidence,
          errorMessage: postStatus === 'error' ? classificationError ?? 'Erro na análise.' : undefined,
          finishedAt: postStatus !== 'analyzed' ? formatNow() : undefined,
        });

        appendItemMessage(next.id, 'Metadados identificados');

        if (recommendedFileName) {
          appendItemMessage(next.id, `Nome sugerido: ${recommendedFileName}`);
        }

        for (const reason of decision.reasons) {
          if (decision.action !== 'save') {
            appendItemMessage(next.id, reason);
          }
        }

        const itemDurationMs = itemStartedAtRef.current.get(next.id)
          ? Date.now() - itemStartedAtRef.current.get(next.id)!
          : undefined;

        workflow.logItem(next.id, next.originalFileName, {
          level: 'info',
          stage: 'analysis',
          message: itemDurationMs
            ? `Processado em ${formatDurationMs(itemDurationMs)}.`
            : 'Processamento concluído.',
          details: { durationMs: itemDurationMs },
        });

        if (postStatus === 'error') {
          markItemAnalysisError(
            next.id,
            classificationError ?? metadata.classificationReason ?? 'Erro na análise do documento.',
          );
          return 'continue';
        }

        if (postStatus === 'requires_review') {
          const reason = getBulkReviewReason({
            ...next,
            status: postStatus,
            result: raw,
            metadata,
            recommendedFileName,
            className,
            confidence: raw.classification.confidence,
          });
          markItemReview(next.id, reason);

          if (autoModeRef.current) {
            setStatusMessage('Preparando próximo envio...');
            await sleep(BULK_NEXT_ITEM_DELAY_MS);
            setStatusMessage(null);
            return 'continue';
          }

          setManualGate(true);
          manualGateRef.current = true;
          setStatusMessage('Aguardando ação manual');
          return 'manual';
        }

        if (!autoEligible) {
          workflow.logItem(next.id, next.originalFileName, {
            level: 'warning',
            stage: 'auto',
            message: 'Documento analisado, mas não elegível para salvamento automático.',
            details: { blockers: autoSaveBlockers },
          });

          if (autoModeRef.current) {
            markItemReview(next.id, autoSaveBlockers[0] ?? 'Revisão necessária.');
            setStatusMessage('Preparando próximo envio...');
            await sleep(BULK_NEXT_ITEM_DELAY_MS);
            setStatusMessage(null);
            return 'continue';
          }

          setManualGate(true);
          manualGateRef.current = true;
          setStatusMessage('Aguardando confirmação manual');
          return 'manual';
        }

        if (autoModeRef.current && autoEligible) {
          patchItem(next.id, { status: 'auto_countdown' });

          workflow.logItem(next.id, next.originalFileName, {
            level: 'info',
            stage: 'auto',
            message: `Countdown criado para item ${next.id}.`,
            details: { seconds: autoDelaySecondsRef.current },
          });

          countdownItemIdRef.current = next.id;
          const countdown = startCountdownSeconds(
            autoDelaySecondsRef.current,
            (remaining) => {
              if (countdownItemIdRef.current !== next.id) return;
              setAutoCountdown(remaining > 0 ? remaining : null);
              if (remaining > 0) {
                setStatusMessage(`Auto ativo: salvando este documento em ${remaining}s.`);
              }
            },
            () =>
              workerRunId === workerRunIdRef.current &&
              runIdRef.current === workerRunId &&
              batchPhaseRef.current === 'running' &&
              countdownItemIdRef.current === next.id &&
              currentItemIdRef.current === next.id &&
              getItemById(next.id)?.status === 'auto_countdown' &&
              Boolean(getItemById(next.id)?.result) &&
              !getItemById(next.id)?.result?.classification.requiresReview &&
              Boolean(getItemById(next.id)?.result?.classification.classId) &&
              Boolean(getItemById(next.id)?.result?.recommendedFileName?.trim()),
          );
          countdownHandleRef.current = countdown;

          const countdownFinished = await countdown.completed;

          if (!countdownFinished) {
            cancelCurrentCountdown('countdown interrompido', next.originalFileName);
            return 'break';
          }

          if (!canApplyToItem(next.id, workerRunId, ['auto_countdown'])) {
            workflow.logItem(next.id, next.originalFileName, {
              level: 'warning',
              stage: 'auto',
              message: 'Tentativa de salvamento automático bloqueada: item atual mudou.',
            });
            return 'break';
          }

          workflow.logItem(next.id, next.originalFileName, {
            level: 'info',
            stage: 'auto',
            message: `Countdown concluído para item ${next.id}.`,
          });

          cancelCurrentCountdown('countdown concluído', next.originalFileName);
          await saveItem(next.id, true, workerRunId);

          setStatusMessage('Documento salvo. Preparando próximo envio...');
          await sleep(BULK_NEXT_ITEM_DELAY_MS);
          setStatusMessage(null);
          return 'continue';
        }

        setManualGate(true);
        manualGateRef.current = true;
        setStatusMessage('Aguardando confirmação manual');
        return 'manual';
      } catch (error) {
        activeAnalysisRequestRef.current = null;

        if (controller.signal.aborted || workerRunId !== workerRunIdRef.current) {
          return 'break';
        }

        const workflowError =
          error instanceof AnalyzePdfRequestError
            ? error.workflowError
            : parseWorkflowErrorPayload(
                null,
                error instanceof Error ? error.message : 'Erro ao analisar documento',
              );
        workflowError.requestId = requestId;
        workflowError.endpoint = '/api/ai/analyze-pdf';

        const itemDurationMs = itemStartedAtRef.current.get(next.id)
          ? Date.now() - itemStartedAtRef.current.get(next.id)!
          : undefined;

        const logDetails = buildWorkflowErrorLogDetails(workflowError, {
          stage: 'Análise',
          endpoint: workflowError.endpoint,
        });

        if (isNonExtractablePdfError({ message: workflowError.message, code: workflowError.code })) {
          workflow.logItem(next.id, next.originalFileName, {
            level: 'warning',
            stage: 'analysis',
            message: NON_EXTRACTABLE_TEXT_MESSAGE,
            details: { code: workflowError.code, durationMs: itemDurationMs, tipo: 'texto_nao_extraivel' },
          });
          markItemReview(next.id, NON_EXTRACTABLE_TEXT_MESSAGE);
          return 'continue';
        }

        if (
          workflowError.code === 'DOCUMENT_RULES_NOT_CONFIGURED' ||
          workflowError.code === 'RULES_NOT_SEEDED'
        ) {
          markItemAnalysisError(next.id, workflowError.message, {
            ...logDetails,
            code: workflowError.code,
            durationMs: itemDurationMs,
            tipo: 'configuracao_documental',
            actionLabel: workflowError.action?.label,
            actionHref: workflowError.action?.href,
          }, { toastMessage: workflowError.toastMessage });
          return 'continue';
        }

        markItemAnalysisError(
          next.id,
          workflowError.message,
          {
            ...logDetails,
            requestId,
            code: workflowError.code,
            durationMs: itemDurationMs,
            tipo: 'erro_analise',
          },
          { toastMessage: workflowError.toastMessage },
        );
        return 'continue';
      }
    },
    [
      appendItemMessage,
      canApplyToItem,
      cancelCurrentCountdown,
      getIsolationSnapshot,
      getItemById,
      logIsolationSnapshot,
      markItemAnalysisError,
      markItemReview,
      patchItem,
      resetCurrentProcessingState,
      saveItem,
      workflow,
    ],
  );

  const processQueue = useCallback(async () => {
    if (isQueueWorkerRunningRef.current) return;
    if (batchPhaseRef.current === 'paused' || batchPhaseRef.current === 'cancelled') return;
    if (manualGateRef.current) return;

    isQueueWorkerRunningRef.current = true;
    const workerRunId = runIdRef.current;
    workerRunIdRef.current = workerRunId;

    workflow.logBatch({
      level: 'info',
      stage: 'queue',
      message: 'Fila iniciada.',
      details: { workerRunId, concurrency: 1 },
    });

    try {
      while (
        batchPhaseRef.current === 'running' &&
        !manualGateRef.current &&
        workerRunId === workerRunIdRef.current &&
        runIdRef.current === workerRunId
      ) {
        const snapshot = itemsRef.current;
        const next = snapshot.find((item) => item.status === 'queued');

        if (!next) {
          tryCompleteBatch();
          break;
        }

        const outcome = await processSingleItem(next.id, workerRunId);

        if (outcome === 'break') {
          break;
        }

        if (outcome === 'manual') {
          break;
        }
      }
    } finally {
      isQueueWorkerRunningRef.current = false;
      abortRef.current = null;
      tryCompleteBatch();
    }
  }, [processSingleItem, tryCompleteBatch, workflow]);

  const scheduleQueueWorker = useCallback(() => {
    if (isQueueWorkerRunningRef.current) return;
    if (batchPhaseRef.current !== 'running') return;
    if (manualGateRef.current) return;
    void processQueue();
  }, [processQueue]);

  useEffect(() => {
    scheduleQueueWorker();
  }, [batchPhase, manualGate, scheduleQueueWorker]);

  const startBatch = useCallback(
    (files: File[], invalidItems: Array<{ file: File; error: string }> = []) => {
      runIdRef.current += 1;
      workerRunIdRef.current = runIdRef.current;
      resetCurrentProcessingState('iniciar lote');

      const nextBatchId = createBatchId();
      setBatchId(nextBatchId);
      batchIdRef.current = nextBatchId;
      workflow.setCurrentBatchId(nextBatchId);
      batchStartedAtRef.current = Date.now();

      const validItems = files.map((file) => createQueueItem(file));
      const errorItems = invalidItems.map(({ file, error }) =>
        createQueueItem(file, 'error', error),
      );

      const allItems = [...validItems, ...errorItems];
      setItems(allItems);
      itemsRef.current = allItems;
      setBatchPhase('running');
      batchPhaseRef.current = 'running';
      setManualGate(false);
      manualGateRef.current = false;
      setCurrentItemId(null);
      currentItemIdRef.current = null;

      workflow.logBatch({
        level: 'info',
        stage: 'queue',
        message: `Lote iniciado com ${allItems.length} documento(s).`,
        details: {
          total: allItems.length,
          accepted: validItems.length,
          rejected: errorItems.length,
          autoMode: autoModeRef.current,
          autoDelaySeconds: autoDelaySecondsRef.current,
          concurrency: 1,
        },
      });

      workflow.logBatch({
        level: 'info',
        stage: 'auto',
        message: autoModeRef.current
          ? `Modo Auto ligado (delay ${autoDelaySecondsRef.current}s).`
          : 'Modo Auto desligado.',
      });

      for (const item of validItems) {
        workflow.logItem(item.id, item.originalFileName, {
          level: 'info',
          stage: 'queue',
          message: 'Documento adicionado à fila.',
          details: { sizeBytes: item.sizeBytes },
        });
        appendItemMessage(item.id, 'Documento adicionado à fila.');
      }

      for (const item of errorItems) {
        workflow.logItem(item.id, item.originalFileName, {
          level: 'error',
          stage: 'validation',
          message: item.errorMessage ?? 'Arquivo rejeitado na validação.',
        });
        appendItemMessage(item.id, item.errorMessage ?? 'Arquivo rejeitado.');
        finishQueueItem(item.id);
      }
    },
    [appendItemMessage, createQueueItem, finishQueueItem, resetCurrentProcessingState, workflow],
  );

  const confirmCurrentAndContinue = useCallback(async () => {
    const itemId = currentItemIdRef.current;
    if (!itemId) return;

    const current = getItemById(itemId);
    if (
      !current ||
      (current.status !== 'analyzed' && current.status !== 'requires_review') ||
      !current.result ||
      !current.metadata
    ) {
      return;
    }

    if (
      !canBulkManualConfirm({
        isAuthenticated: isAuthenticatedRef.current,
        metadata: current.metadata,
        rawAnalysis: current.result,
      })
    ) {
      return;
    }

    const workerRunId = runIdRef.current;
    await saveItem(itemId, false, workerRunId);

    setManualGate(false);
    manualGateRef.current = false;
    setStatusMessage('Documento salvo. Preparando próximo envio...');
    await sleep(BULK_NEXT_ITEM_DELAY_MS);
    setStatusMessage(null);
    scheduleQueueWorker();
  }, [getItemById, saveItem, scheduleQueueWorker]);

  const skipCurrent = useCallback(() => {
    const itemId = currentItemIdRef.current;
    if (!itemId) return;

    const item = getItemById(itemId);
    patchItem(itemId, { status: 'skipped', finishedAt: formatNow() });
    workflow.logItem(itemId, item?.originalFileName, {
      level: 'warning',
      stage: 'queue',
      message: 'Documento pulado.',
    });
    appendItemMessage(itemId, 'Documento pulado');
    finishQueueItem(itemId);

    setManualGate(false);
    manualGateRef.current = false;
    scheduleQueueWorker();
  }, [appendItemMessage, finishQueueItem, getItemById, patchItem, scheduleQueueWorker, workflow]);

  const reprocessCurrent = useCallback(() => {
    const itemId = currentItemIdRef.current;
    if (!itemId) return;

    const item = getItemById(itemId);
    resetCurrentProcessingState('reprocessar item');
    patchItem(itemId, {
      status: 'queued',
      errorMessage: undefined,
      result: undefined,
      metadata: undefined,
      recommendedFileName: undefined,
      finalFileName: undefined,
      className: undefined,
      confidence: undefined,
      documentId: undefined,
      versionId: undefined,
      logs: [],
      startedAt: undefined,
      finishedAt: undefined,
    });
    workflow.logItem(itemId, item?.originalFileName, {
      level: 'info',
      stage: 'queue',
      message: 'Documento reenfileirado para reprocessamento.',
    });

    setManualGate(false);
    manualGateRef.current = false;
    setCurrentItemId(null);
    currentItemIdRef.current = null;
    scheduleQueueWorker();
  }, [getItemById, patchItem, resetCurrentProcessingState, scheduleQueueWorker, workflow]);

  const pauseBatch = useCallback(() => {
    runIdRef.current += 1;
    resetCurrentProcessingState('pausar lote');
    setBatchPhase('paused');
    batchPhaseRef.current = 'paused';
    setStatusMessage('Lote pausado');
    workflow.logBatch({
      level: 'warning',
      stage: 'queue',
      message: 'Lote pausado.',
    });
  }, [resetCurrentProcessingState, workflow]);

  const resumeBatch = useCallback(() => {
    setBatchPhase('running');
    batchPhaseRef.current = 'running';
    setStatusMessage(null);
    workflow.logBatch({
      level: 'info',
      stage: 'queue',
      message: 'Lote retomado.',
    });
    scheduleQueueWorker();
  }, [scheduleQueueWorker, workflow]);

  const cancelBatch = useCallback(() => {
    runIdRef.current += 1;
    resetCurrentProcessingState('cancelar lote');
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.status !== 'queued') return item;
        workflow.logItem(item.id, item.originalFileName, {
          level: 'warning',
          stage: 'queue',
          message: 'Item cancelado com o lote.',
        });
        return { ...item, status: 'skipped' as const, finishedAt: formatNow() };
      });
      itemsRef.current = next;
      return next;
    });
    setBatchPhase('cancelled');
    batchPhaseRef.current = 'cancelled';
    setManualGate(false);
    manualGateRef.current = false;
    setCurrentItemId(null);
    currentItemIdRef.current = null;
    workflow.logBatch({
      level: 'warning',
      stage: 'queue',
      message: 'Lote cancelado.',
    });
  }, [resetCurrentProcessingState, workflow]);

  const resetBatch = useCallback(() => {
    runIdRef.current += 1;
    resetCurrentProcessingState('resetar lote');
    setItems([]);
    itemsRef.current = [];
    setBatchId(null);
    batchIdRef.current = null;
    workflow.setCurrentBatchId(null);
    setBatchPhase('idle');
    batchPhaseRef.current = 'idle';
    setCurrentItemId(null);
    currentItemIdRef.current = null;
    setManualGate(false);
    manualGateRef.current = false;
    batchStartedAtRef.current = null;
    itemStartedAtRef.current.clear();
  }, [resetCurrentProcessingState, workflow]);

  const clearCompleted = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((item) => !['saved', 'skipped', 'error'].includes(item.status));
      itemsRef.current = next;
      return next;
    });
  }, []);

  const currentItem = items.find((item) => item.id === currentItemId) ?? null;

  return {
    items,
    batchId,
    batchPhase,
    currentItem,
    currentItemId,
    autoCountdown,
    manualGate,
    statusMessage,
    startBatch,
    confirmCurrentAndContinue,
    skipCurrent,
    reprocessCurrent,
    pauseBatch,
    resumeBatch,
    cancelBatch,
    resetBatch,
    clearCompleted,
  };
}
