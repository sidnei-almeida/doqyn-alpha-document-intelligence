import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/useAuth';
import { BulkBatchPanel } from './components/BulkBatchPanel';
import { AutoModeToggle } from './components/AutoModeToggle';
import { ProcessingCard } from './components/ProcessingCard';
import { ProcessingErrorCard } from './components/ProcessingErrorCard';
import { SavedFeedbackCard } from './components/SavedFeedbackCard';
import { UploadCard } from './components/UploadCard';
import { WorkflowSessionPanel } from './components/WorkflowSessionPanel';
import { UploadResultPanel } from './components/UploadResultPanel';
import { generateDocumentId } from './mockData';
import { analyzePdf, AnalyzePdfRequestError, type AnalyzePdfResponse } from './services/analyzePdf';
import { confirmAnalysis } from './services/confirmAnalysis';
import {
  clampAutoDelaySeconds,
} from './uploadConstants';
import { useBulkUploadQueue, type BulkHistoryPayload, type BulkTerminalPayload } from './hooks/useBulkUploadQueue';
import { useWorkflowLogger } from './hooks/useWorkflowLogger';
import {
  useSemiDeterminateProgress,
  useSimulatedStepIndex,
} from './hooks/useProcessingProgress';
import {
  loadAutoDelaySeconds,
  loadAutoMode,
  saveAutoDelaySeconds,
  saveAutoMode,
} from './utils/autoDelayStorage';
import type {
  DocumentHistoryItem,
  ExtractedMetadata,
  HistoryStatus,
  ProcessingLogItem,
  SendFlowPhase,
  UploadedDocument,
} from './types';
import type { WorkflowLogFilter } from './types/workflowLog';
import type { WorkflowErrorDisplay } from './types/workflowError';
import {
  buildAnalysisDecision,
  createRequestId,
  formatDurationMs,
  mapProcessingLogsToWorkflowEvents,
} from './utils/workflowLogHelpers';
import {
  buildWorkflowErrorLogDetails,
  parseWorkflowErrorPayload,
} from './utils/workflowErrors';
import { canAutoConfirm } from './utils/autoConfirm';
import { formatHistoryDate } from './utils/historyFormat';

type AnalysisSnapshot = {
  metadata: ExtractedMetadata;
  logs: ProcessingLogItem[];
  rawAnalysis: AnalyzePdfResponse | null;
  fileName: string;
  fileSize: number;
};

function formatNow(): string {
  const now = new Date();
  return `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function toHistoryStatus(metadata: ExtractedMetadata): HistoryStatus {
  if (metadata.analysisStatus === 'ai_unavailable') return 'error';
  if (metadata.analysisStatus === 'requires_review') return 'requires_review';
  if (metadata.analysisStatus === 'failed') return 'error';
  return 'metadata_confirmed';
}

function createAnalyzingHistoryItem(docId: string, file: File): DocumentHistoryItem {
  const now = new Date();
  return {
    id: docId,
    originalName: file.name,
    suggestedName: '—',
    category: '—',
    status: 'analyzing',
    confidenceScore: 0,
    version: '—',
    uploadedAt: formatHistoryDate(now),
    uploadedAtIso: now.toISOString(),
    lastActionAt: formatNow(),
    fileSize: file.size,
  };
}

function toHistoryItem(
  doc: UploadedDocument,
  metadata: ExtractedMetadata,
  options?: {
    lastActionLabel?: string;
    logs?: ProcessingLogItem[];
    uploadedAt?: string;
    uploadedAtIso?: string;
    errorMessage?: string;
  },
): DocumentHistoryItem {
  return {
    id: doc.id,
    originalName: doc.originalName,
    suggestedName: metadata.suggestedName,
    category: metadata.documentType,
    status: toHistoryStatus(metadata),
    confidenceScore: metadata.confidenceScore,
    version: metadata.suggestedVersion,
    uploadedAt: options?.uploadedAt ?? formatHistoryDate(new Date()),
    uploadedAtIso: options?.uploadedAtIso,
    lastActionAt: formatNow(),
    lastActionLabel: options?.lastActionLabel,
    fileSize: doc.fileSize,
    metadata,
    logs: options?.logs,
    errorMessage: options?.errorMessage,
  };
}

function createInitialLogs(): ProcessingLogItem[] {
  return [
    {
      id: 'log-1',
      title: 'Documento recebido',
      description: 'Enviando PDF para análise...',
      time: '',
      status: 'active',
    },
  ];
}

function createErrorMetadata(file: File): ExtractedMetadata {
  return {
    suggestedName: '—',
    documentType: 'Indefinido',
    suggestedVersion: 'v1.0',
    confidenceScore: 0,
    analysisStatus: 'failed',
    originalFileName: file.name,
  };
}

export function DocumentSendPage() {
  const { isAuthenticated } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const analysisGenerationRef = useRef(0);
  const autoConfirmTriggeredRef = useRef(false);
  const filesByDocIdRef = useRef<Map<string, File>>(new Map());
  const snapshotsRef = useRef<Record<string, AnalysisSnapshot>>({});
  const completingTimerRef = useRef<number | null>(null);

  const [flowPhase, setFlowPhase] = useState<SendFlowPhase>('idle');
  const [autoMode, setAutoMode] = useState(loadAutoMode);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(loadAutoDelaySeconds);
  const [autoPaused, setAutoPaused] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [lastAutoSaved, setLastAutoSaved] = useState(false);
  const [returnCountdown, setReturnCountdown] = useState<number | null>(null);

  const [activeMetadata, setActiveMetadata] = useState<ExtractedMetadata | null>(null);
  const [logs, setLogs] = useState<ProcessingLogItem[]>([]);
  const [history, setHistory] = useState<DocumentHistoryItem[]>([]);
  const [lastProcessedFile, setLastProcessedFile] = useState<File | null>(null);
  const [rawAnalysis, setRawAnalysis] = useState<AnalyzePdfResponse | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [manualReviewChecked, setManualReviewChecked] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<WorkflowErrorDisplay | null>(null);
  const [logFilter, setLogFilter] = useState<WorkflowLogFilter>('all');
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  const workflow = useWorkflowLogger();
  const itemStartedAtRef = useRef<number | null>(null);

  const isProcessingView = flowPhase === 'analyzing' || flowPhase === 'completing';
  const isProcessingComplete = flowPhase === 'completing';
  const processingProgress = useSemiDeterminateProgress(isProcessingView, isProcessingComplete);
  const simulatedStepIndex = useSimulatedStepIndex(
    flowPhase === 'analyzing',
    isProcessingComplete,
  );

  const clearCompletingTimer = useCallback(() => {
    if (completingTimerRef.current !== null) {
      window.clearTimeout(completingTimerRef.current);
      completingTimerRef.current = null;
    }
  }, []);

  const handleBulkItemSaved = useCallback(({ item, autoSaved }: BulkHistoryPayload) => {
    if (!item.metadata) return;

    const savedMetadata: ExtractedMetadata = {
      ...item.metadata,
      savedDocumentId: item.documentId,
      savedVersionId: item.versionId,
      suggestedName: item.finalFileName ?? item.metadata.suggestedName,
    };

    const processedDoc: UploadedDocument = {
      id: item.id,
      originalName: item.originalFileName,
      suggestedName: savedMetadata.suggestedName,
      fileSize: item.sizeBytes,
      mimeType: 'application/pdf',
      category: savedMetadata.documentType,
      status: 'confirmed',
      version: savedMetadata.suggestedVersion,
      metadata: savedMetadata,
      uploadedAt: formatNow(),
      lastActionAt: formatNow(),
    };

    workflow.logItem(item.id, item.originalFileName, {
      level: 'success',
      stage: 'history',
      message: 'Item adicionado ao histórico da sessão.',
      details: { finalStatus: 'saved', autoSaved },
    });

    setHistory((prev) => [
      toHistoryItem(processedDoc, savedMetadata, {
        lastActionLabel: autoSaved ? 'Salvo automaticamente' : 'Confirmado no lote',
      }),
      ...prev.filter((entry) => entry.id !== item.id),
    ]);
  }, [workflow]);

  const handleBulkItemTerminal = useCallback(({ item, autoSaved }: BulkTerminalPayload) => {
    if (item.status === 'saved') return;

    workflow.logItem(item.id, item.originalFileName, {
      level: item.status === 'error' ? 'error' : 'warning',
      stage: 'history',
      message: 'Item finalizado (visível nos logs do lote).',
      details: { finalStatus: item.status, autoSaved },
    });
  }, [workflow]);

  const bulkQueue = useBulkUploadQueue({
    autoMode,
    autoDelaySeconds,
    isAuthenticated,
    workflow,
    onItemSaved: handleBulkItemSaved,
    onItemTerminal: handleBulkItemTerminal,
  });

  const handleAutoModeChange = useCallback((enabled: boolean) => {
    setAutoMode(enabled);
    saveAutoMode(enabled);
    workflow.log({
      level: 'info',
      stage: 'auto',
      message: enabled ? 'Modo Auto ligado.' : 'Modo Auto desligado.',
      details: { autoDelaySeconds },
    });
  }, [autoDelaySeconds, workflow]);

  const handleAutoDelayChange = useCallback((seconds: number) => {
    const clamped = clampAutoDelaySeconds(seconds);
    setAutoDelaySeconds(clamped);
    saveAutoDelaySeconds(clamped);
    workflow.log({
      level: 'info',
      stage: 'auto',
      message: `Delay do Auto definido para ${clamped}s.`,
    });
  }, [workflow]);

  const resetToIdle = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    autoConfirmTriggeredRef.current = false;
    clearCompletingTimer();
    setFlowPhase('idle');
    setAutoCountdown(null);
    setAutoPaused(false);
    setLastAutoSaved(false);
    setReturnCountdown(null);
    setActiveMetadata(null);
    setLogs([]);
    setLastProcessedFile(null);
    setRawAnalysis(null);
    setManualReviewChecked(false);
    setCurrentDocId(null);
    setIsConfirming(false);
    setAnalysisError(null);
  }, [clearCompletingTimer]);

  const processFile = useCallback(async (file: File) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const generation = ++analysisGenerationRef.current;
    const docId = generateDocumentId();
    const timestamp = formatNow();

    clearCompletingTimer();
    setFlowPhase('analyzing');
    itemStartedAtRef.current = Date.now();
    workflow.setSelectedItemId(docId);
    setAutoPaused(false);
    setAutoCountdown(null);
    autoConfirmTriggeredRef.current = false;
    setActiveMetadata(null);
    setRawAnalysis(null);
    setManualReviewChecked(false);
    setLastProcessedFile(file);
    setCurrentDocId(docId);
    filesByDocIdRef.current.set(docId, file);
    setLogs(createInitialLogs());
    setAnalysisError(null);
    setHistory((prev) => [createAnalyzingHistoryItem(docId, file), ...prev]);

    workflow.logItem(docId, file.name, {
      level: 'info',
      stage: 'queue',
      message: 'Documento adicionado para análise.',
      details: { sizeBytes: file.size },
    });
    workflow.logItem(docId, file.name, {
      level: 'info',
      stage: 'analysis',
      message: 'Análise iniciada.',
    });

    try {
      const response = await analyzePdf(file, {
        signal: controller.signal,
        context: {
          itemId: docId,
          fileName: file.name,
          requestId: createRequestId(),
        },
      });
      const { metadata, logs: apiLogs, raw } = response;

      if (generation !== analysisGenerationRef.current) return;

      workflow.logItem(docId, file.name, {
        level: 'success',
        stage: 'analysis',
        message: 'Resposta da análise recebida.',
        details: {
          httpStatus: response.httpStatus,
          durationMs: response.durationMs,
          requestId: response.requestId,
        },
      });

      for (const mapped of mapProcessingLogsToWorkflowEvents(apiLogs, {
        itemId: docId,
        fileName: file.name,
      })) {
        workflow.log(mapped);
      }

      const decision = buildAnalysisDecision(raw, metadata);
      workflow.logItem(docId, file.name, {
        level:
          decision.action === 'error'
            ? 'error'
            : decision.action === 'save'
              ? 'success'
              : 'warning',
        stage: decision.action === 'error' ? 'error' : 'review',
        message:
          decision.action === 'save'
            ? 'Metadados identificados.'
            : decision.action === 'error'
              ? 'Erro na análise do documento.'
              : 'Documento requer revisão.',
        details: {
          ...decision.details,
          decision: decision.action,
          reasons: decision.reasons,
        },
      });

      const totalDurationMs = itemStartedAtRef.current
        ? Date.now() - itemStartedAtRef.current
        : response.durationMs;
      workflow.logItem(docId, file.name, {
        level: 'info',
        stage: 'analysis',
        message: `Processado em ${formatDurationMs(totalDurationMs)}.`,
        details: { durationMs: totalDurationMs },
      });

      setLogs(apiLogs);
      setActiveMetadata(metadata);
      setRawAnalysis(raw);

      const nextPhase =
        metadata.analysisStatus === 'failed' || metadata.analysisStatus === 'ai_unavailable'
          ? 'error'
          : 'completed';
      setFlowPhase('completing');

      if (autoMode && metadata.analysisStatus === 'requires_review') {
        setAutoPaused(true);
        workflow.logItem(docId, file.name, {
          level: 'warning',
          stage: 'auto',
          message: 'Auto pausado por revisão.',
        });
      }

      completingTimerRef.current = window.setTimeout(() => {
        if (generation !== analysisGenerationRef.current) return;
        setFlowPhase(nextPhase);
        completingTimerRef.current = null;
      }, 260);

      const processedDoc: UploadedDocument = {
        id: docId,
        originalName: file.name,
        suggestedName: metadata.suggestedName,
        fileSize: file.size,
        mimeType: file.type || 'application/pdf',
        category: metadata.documentType,
        status:
          metadata.analysisStatus === 'requires_review' ? 'requires_review' : 'name_generated',
        version: metadata.suggestedVersion,
        metadata,
        uploadedAt: timestamp,
        lastActionAt: formatNow(),
      };

      setHistory((prev) => {
        const existing = prev.find((item) => item.id === docId);
        return prev.map((item) =>
          item.id === docId
            ? toHistoryItem(processedDoc, metadata, {
                logs: apiLogs,
                uploadedAt: existing?.uploadedAt,
                uploadedAtIso: existing?.uploadedAtIso,
              })
            : item,
        );
      });

      snapshotsRef.current[docId] = {
        metadata,
        logs: apiLogs,
        rawAnalysis: raw,
        fileName: file.name,
        fileSize: file.size,
      };

      workflow.logItem(docId, file.name, {
        level: 'success',
        stage: 'history',
        message: 'Histórico da sessão atualizado.',
        details: { status: metadata.analysisStatus },
      });

      if (metadata.analysisStatus === 'completed') {
        toast.success('Análise concluída');
      } else if (metadata.analysisStatus === 'requires_review') {
        toast.message('Requer revisão', {
          description: metadata.classificationReason,
        });
      } else if (metadata.analysisStatus === 'ai_unavailable') {
        toast.warning('Análise automática indisponível', {
          description: metadata.classificationReason,
        });
      }
    } catch (error) {
      if (controller.signal.aborted || generation !== analysisGenerationRef.current) return;

      const workflowError =
        error instanceof AnalyzePdfRequestError
          ? error.workflowError
          : parseWorkflowErrorPayload(
              null,
              error instanceof Error ? error.message : 'Erro ao analisar documento',
            );

      setAnalysisError(workflowError);

      const errorLogs: ProcessingLogItem[] = [
        {
          id: 'log-error',
          title: workflowError.title,
          description: workflowError.message,
          time: formatNow(),
          status: 'error',
        },
      ];
      setLogs(errorLogs);
      setActiveMetadata(createErrorMetadata(file));
      setFlowPhase('error');

      const logDetails = buildWorkflowErrorLogDetails(workflowError, {
        stage: 'Análise',
        endpoint: workflowError.endpoint,
        showDebug: showDebugLogs,
      });

      workflow.logItem(docId, file.name, {
        level: 'error',
        stage: 'analysis',
        message: workflowError.title,
        details: logDetails,
      });
      workflow.logItem(docId, file.name, {
        level: 'error',
        stage: 'history',
        message: 'Histórico atualizado com erro.',
        details: { category: workflowError.category },
      });

      setHistory((prev) =>
        prev.map((item) =>
          item.id === docId
            ? {
                ...item,
                status: 'error' as const,
                suggestedName: '—',
                category: 'Indefinido',
                metadata: createErrorMetadata(file),
                logs: errorLogs,
                errorMessage: workflowError.message,
              }
            : item,
        ),
      );
      snapshotsRef.current[docId] = {
        metadata: createErrorMetadata(file),
        logs: errorLogs,
        rawAnalysis: null,
        fileName: file.name,
        fileSize: file.size,
      };
      toast.error(workflowError.toastMessage);
    }
  }, [autoMode, clearCompletingTimer, showDebugLogs, workflow]);

  const handleFilesSelected = useCallback(
    (files: File[], invalidItems: Array<{ file: File; error: string }>) => {
      workflow.log({
        level: 'info',
        stage: 'validation',
        message: `${files.length + invalidItems.length} arquivo(s) selecionado(s).`,
        details: {
          accepted: files.map((file) => ({ name: file.name, sizeBytes: file.size })),
          rejected: invalidItems.map(({ file, error }) => ({ name: file.name, reason: error })),
        },
      });

      for (const { file, error } of invalidItems) {
        workflow.log({
          level: 'error',
          stage: 'validation',
          message: error,
          fileName: file.name,
        });
      }

      if (files.length === 1 && invalidItems.length === 0) {
        void processFile(files[0]);
        return;
      }

      bulkQueue.startBatch(files, invalidItems);
    },
    [bulkQueue, processFile, workflow],
  );

  const handleCancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    analysisGenerationRef.current += 1;
    if (currentDocId && lastProcessedFile) {
      workflow.logItem(currentDocId, lastProcessedFile.name, {
        level: 'warning',
        stage: 'ui',
        message: 'Análise cancelada pelo usuário.',
      });
    }
    resetToIdle();
  }, [currentDocId, lastProcessedFile, resetToIdle, workflow]);

  const handleReprocess = useCallback(() => {
    if (!lastProcessedFile) return;
    setAutoPaused(true);
    setAutoCountdown(null);
    void processFile(lastProcessedFile);
  }, [lastProcessedFile, processFile]);

  const handleConfirm = useCallback(
    async (options?: { autoSaved?: boolean }) => {
      if (!rawAnalysis || !activeMetadata || !lastProcessedFile || !currentDocId) return;

      const requiresReview = activeMetadata.analysisStatus === 'requires_review';
      if (requiresReview && !manualReviewChecked) {
        toast.error('Marque que revisou os campos antes de confirmar.');
        return;
      }

      if (!requiresReview && activeMetadata.analysisStatus !== 'completed') {
        toast.error('Este documento ainda não está pronto para confirmação.');
        return;
      }

      if (!rawAnalysis.classification.classId || !rawAnalysis.recommendedFileName) {
        toast.error('Classificação ou nome sugerido ausente. Não é possível salvar.');
        return;
      }

      setFlowPhase('saving');
      setIsConfirming(true);
      setAutoCountdown(null);

      workflow.logItem(currentDocId, lastProcessedFile.name, {
        level: 'info',
        stage: 'confirmation',
        message: options?.autoSaved ? 'Salvamento automático iniciado.' : 'Confirmação manual iniciada.',
      });

      const confirmStartedAt = Date.now();
      try {
        const result = await confirmAnalysis(rawAnalysis, {
          manualReviewConfirmed: requiresReview,
          context: {
            itemId: currentDocId,
            fileName: lastProcessedFile.name,
            requestId: createRequestId(),
          },
        });

        const savedMetadata: ExtractedMetadata = {
          ...activeMetadata,
          savedDocumentId: result.documentId,
          savedVersionId: result.versionId,
          documentCode: result.documentCode,
          storageStatus: result.storageStatus,
        };

        setActiveMetadata(savedMetadata);
        const actionLabel = options?.autoSaved
          ? 'Salvo automaticamente'
          : 'Metadados confirmados';

        workflow.logItem(currentDocId, lastProcessedFile.name, {
          level: 'success',
          stage: 'persistence',
          message: options?.autoSaved
            ? 'Salvamento automático concluído.'
            : 'Documento salvo com sucesso.',
          details: {
            documentId: result.documentId,
            versionId: result.versionId,
            storageStatus: result.storageStatus,
            durationMs: Date.now() - confirmStartedAt,
            httpStatus: result.httpStatus,
            requestId: result.requestId,
          },
        });

        setHistory((prev) =>
          prev.map((item) =>
            item.id === currentDocId
              ? {
                  ...item,
                  status: 'metadata_confirmed' as const,
                  metadata: savedMetadata,
                  lastActionAt: formatNow(),
                  lastActionLabel: actionLabel,
                }
              : item,
          ),
        );

        if (currentDocId) {
          const snapshot = snapshotsRef.current[currentDocId];
          if (snapshot) {
            snapshotsRef.current[currentDocId] = {
              ...snapshot,
              metadata: savedMetadata,
            };
          }
        }

        if (options?.autoSaved) {
          setLastAutoSaved(true);
          setFlowPhase('saved');
          workflow.log({
            level: 'info',
            stage: 'auto',
            message: 'Retorno ao upload agendado.',
            itemId: currentDocId,
            fileName: lastProcessedFile.name,
            details: { delaySeconds: autoDelaySeconds },
          });
          toast.success('Documento salvo com sucesso');
        } else {
          setFlowPhase('completed');
          toast.success('Documento salvo com sucesso');
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível salvar o documento.';
        workflow.logItem(currentDocId, lastProcessedFile.name, {
          level: 'error',
          stage: 'persistence',
          message,
          details: { durationMs: Date.now() - confirmStartedAt },
        });
        setFlowPhase('completed');
        toast.error(message);
      } finally {
        setIsConfirming(false);
      }
    },
    [activeMetadata, autoDelaySeconds, currentDocId, lastProcessedFile, manualReviewChecked, rawAnalysis, workflow],
  );

  const handleCancelAuto = useCallback(() => {
    setAutoPaused(true);
    setAutoCountdown(null);
    workflow.log({
      level: 'warning',
      stage: 'auto',
      message: 'Contagem regressiva cancelada.',
      itemId: currentDocId ?? undefined,
      fileName: lastProcessedFile?.name,
    });
  }, [currentDocId, lastProcessedFile, workflow]);

  const handleManualReview = useCallback(() => {
    setAutoPaused(true);
    setAutoCountdown(null);
    workflow.log({
      level: 'info',
      stage: 'auto',
      message: 'Auto pausado para revisão manual.',
      itemId: currentDocId ?? undefined,
      fileName: lastProcessedFile?.name,
    });
  }, [currentDocId, lastProcessedFile, workflow]);

  const handleSelectHistoryItem = useCallback((item: DocumentHistoryItem) => {
    if (item.status === 'analyzing' || item.id === currentDocId) return;

    const snapshot = snapshotsRef.current[item.id];
    const metadata = snapshot?.metadata ?? item.metadata;
    if (!metadata) return;

    setAutoPaused(true);
    setAutoCountdown(null);
    autoConfirmTriggeredRef.current = true;
    setCurrentDocId(item.id);
    setActiveMetadata(metadata);
    setLogs(snapshot?.logs ?? item.logs ?? []);
    setRawAnalysis(snapshot?.rawAnalysis ?? null);
    setManualReviewChecked(false);

    const sessionFile = filesByDocIdRef.current.get(item.id);
    setLastProcessedFile(sessionFile ?? null);

    setFlowPhase(item.status === 'error' ? 'error' : 'completed');
  }, [currentDocId]);

  const requiresReview = activeMetadata?.analysisStatus === 'requires_review';
  const hasValidAnalysis =
    Boolean(rawAnalysis?.classification.classId) && Boolean(rawAnalysis?.recommendedFileName);

  const canConfirm =
    Boolean(activeMetadata) &&
    !activeMetadata?.savedDocumentId &&
    Boolean(rawAnalysis) &&
    hasValidAnalysis &&
    flowPhase !== 'error' &&
    (requiresReview ? manualReviewChecked : activeMetadata?.analysisStatus === 'completed');

  const autoEligible = canAutoConfirm({
    autoMode,
    isAuthenticated,
    metadata: activeMetadata,
    rawAnalysis,
    autoPaused,
  });

  useEffect(() => {
    if (!autoEligible || flowPhase !== 'completed' || autoConfirmTriggeredRef.current) {
      return;
    }

    setAutoCountdown(autoDelaySeconds);
    workflow.log({
      level: 'info',
      stage: 'auto',
      message: `Contagem regressiva iniciada (${autoDelaySeconds}s).`,
      itemId: currentDocId ?? undefined,
      fileName: lastProcessedFile?.name,
    });
  }, [autoEligible, autoDelaySeconds, currentDocId, flowPhase, lastProcessedFile, workflow]);

  useEffect(() => {
    if (autoCountdown === null || autoCountdown <= 0 || autoPaused || !autoEligible) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAutoCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [autoCountdown, autoPaused, autoEligible]);

  useEffect(() => {
    if (
      autoCountdown !== 0 ||
      autoPaused ||
      !autoEligible ||
      autoConfirmTriggeredRef.current ||
      flowPhase !== 'completed'
    ) {
      return;
    }

    autoConfirmTriggeredRef.current = true;
    void handleConfirm({ autoSaved: true });
  }, [autoCountdown, autoPaused, autoEligible, flowPhase, handleConfirm]);

  useEffect(() => {
    if (flowPhase !== 'saved' || !lastAutoSaved) return;

    setReturnCountdown(autoDelaySeconds);

    const timer = window.setTimeout(() => {
      resetToIdle();
    }, autoDelaySeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [flowPhase, lastAutoSaved, resetToIdle, autoDelaySeconds]);

  useEffect(() => {
    if (returnCountdown === null || returnCountdown <= 0 || flowPhase !== 'saved') return;

    const timer = window.setTimeout(() => {
      setReturnCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [returnCountdown, flowPhase]);

  const showProcessing = isProcessingView && lastProcessedFile;
  const showError =
    flowPhase === 'error' && lastProcessedFile && activeMetadata && currentDocId;
  const showResult =
    (flowPhase === 'completed' || flowPhase === 'saving') && activeMetadata && currentDocId;

  const errorMessage =
    analysisError?.message ??
    logs.find((log) => log.status === 'error')?.description ??
    logs.at(-1)?.description ??
    'Ocorreu um erro inesperado. Tente novamente.';

  const activeSnapshot = currentDocId ? snapshotsRef.current[currentDocId] : undefined;
  const displayFileName =
    lastProcessedFile?.name ??
    activeSnapshot?.fileName ??
    history.find((item) => item.id === currentDocId)?.originalName ??
    '';
  const displayFileSize =
    lastProcessedFile?.size ??
    activeSnapshot?.fileSize ??
    history.find((item) => item.id === currentDocId)?.fileSize ??
    0;

  const canReprocessCurrent =
    Boolean(currentDocId) &&
    Boolean(filesByDocIdRef.current.get(currentDocId ?? '')) &&
    flowPhase !== 'saving';

  const isBulkActive = bulkQueue.batchPhase !== 'idle';
  const sessionItemId = isBulkActive ? bulkQueue.currentItemId : currentDocId;
  const batchWorkflowLogs = bulkQueue.batchId
    ? workflow.getBatchLogs(bulkQueue.batchId)
    : [];
  const visibleWorkflowLogs = workflow.filterEvents({
    filter: logFilter,
    itemId: logFilter === 'current' ? sessionItemId : null,
    showDebug: showDebugLogs,
  });

  const isResultView =
    !isBulkActive &&
    (flowPhase === 'completed' || flowPhase === 'saving' || flowPhase === 'error');

  return (
    <div className="flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex-col gap-4 overflow-hidden">
      <PageHeader
        className={cn('shrink-0', isResultView && 'mb-3 pb-3')}
        eyebrow="Processamento"
        title="Envio de Documentos"
        description="Envie um PDF textual para análise automática. Nomes e metadados são gerados após o processamento."
        actions={
          <AutoModeToggle
            enabled={autoMode}
            onChange={handleAutoModeChange}
            delaySeconds={autoDelaySeconds}
            onDelaySecondsChange={handleAutoDelayChange}
            disabled={
              flowPhase === 'analyzing' ||
              flowPhase === 'completing' ||
              flowPhase === 'saving' ||
              bulkQueue.batchPhase === 'running'
            }
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isBulkActive ? (
            <BulkBatchPanel
              className="min-h-0 flex-1"
              items={bulkQueue.items}
              batchLogs={batchWorkflowLogs}
              batchPhase={bulkQueue.batchPhase}
              currentItem={bulkQueue.currentItem}
              autoCountdown={bulkQueue.autoCountdown}
              manualGate={bulkQueue.manualGate}
              statusMessage={bulkQueue.statusMessage}
              autoMode={autoMode}
              isAuthenticated={isAuthenticated}
              selectedItemId={workflow.selectedItemId}
              onSelectItem={workflow.setSelectedItemId}
              onConfirmContinue={() => void bulkQueue.confirmCurrentAndContinue()}
              onSkip={bulkQueue.skipCurrent}
              onReprocess={bulkQueue.reprocessCurrent}
              onPause={bulkQueue.pauseBatch}
              onResume={bulkQueue.resumeBatch}
              onCancel={bulkQueue.cancelBatch}
              onNewBatch={bulkQueue.resetBatch}
              onClearCompleted={bulkQueue.clearCompleted}
            />
          ) : (
            <>
              {flowPhase === 'idle' && (
                <UploadCard
                  onFilesSelected={handleFilesSelected}
                  onValidationError={(msg) => toast.error(msg)}
                />
              )}

              {(showProcessing || showError || showResult) && (
                <div className="flex min-h-[300px] min-h-0 flex-1 flex-col">
                  {showProcessing && (
                    <ProcessingCard
                      className="min-h-0 flex-1"
                      file={lastProcessedFile!}
                      progress={processingProgress}
                      logs={logs}
                      isCompleting={isProcessingComplete}
                      simulatedStepIndex={simulatedStepIndex}
                      onCancel={handleCancelAnalysis}
                    />
                  )}

                  {showError && (
                    <ProcessingErrorCard
                      className="min-h-0 flex-1"
                      fileName={displayFileName}
                      fileSize={displayFileSize}
                      title={analysisError?.title}
                      message={errorMessage}
                      suggestion={analysisError?.suggestion}
                      action={analysisError?.action}
                      devHint={analysisError?.devHint}
                      showDebug={showDebugLogs}
                      debugDetails={
                        analysisError
                          ? buildWorkflowErrorLogDetails(analysisError, {
                              endpoint: analysisError.endpoint,
                              showDebug: showDebugLogs,
                            })
                          : undefined
                      }
                      onRetry={handleReprocess}
                      onChooseAnother={resetToIdle}
                    />
                  )}

                  {showResult && (
                    <UploadResultPanel
                      className="min-h-0 flex-1"
                      fileName={displayFileName}
                      fileSize={displayFileSize}
                      metadata={activeMetadata!}
                      logs={logs}
                      flowPhase={flowPhase === 'saving' ? 'saving' : 'completed'}
                      onConfirm={() => void handleConfirm()}
                      onReprocess={handleReprocess}
                      onNextDocument={resetToIdle}
                      canReprocess={canReprocessCurrent}
                      isConfirming={isConfirming}
                      canConfirm={canConfirm}
                      requiresManualReview={requiresReview}
                      manualReviewChecked={manualReviewChecked}
                      onManualReviewCheckedChange={setManualReviewChecked}
                      autoCountdown={autoEligible && !autoPaused ? autoCountdown : null}
                      autoPaused={autoPaused}
                      autoMode={autoMode}
                      onCancelAuto={handleCancelAuto}
                      onManualReview={handleManualReview}
                    />
                  )}
                </div>
              )}

              {flowPhase === 'saved' && (
                <SavedFeedbackCard
                  autoSaved={lastAutoSaved}
                  returnCountdown={returnCountdown}
                  className="flex min-h-[200px] flex-1 flex-col justify-center max-md:min-h-[30vh]"
                />
              )}
            </>
          )}
        </div>

        <WorkflowSessionPanel
          events={visibleWorkflowLogs}
          filter={logFilter}
          onFilterChange={setLogFilter}
          showDebug={showDebugLogs}
          onShowDebugChange={setShowDebugLogs}
          currentItemId={sessionItemId}
          historyItems={history}
          activeHistoryId={isResultView || isBulkActive ? sessionItemId : null}
          onSelectHistoryItem={handleSelectHistoryItem}
        />
      </div>
    </div>
  );
}
