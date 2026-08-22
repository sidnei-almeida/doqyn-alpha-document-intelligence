import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/useAuth';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';
import { canViewDocumentTracking } from '@/features/tracking/utils/trackingAccess';
import { BulkBatchPanel } from './components/BulkBatchPanel';
import { ReviewWorkflowSettingsPanel } from './components/ReviewWorkflowSettingsPanel';
import { ProcessingCard } from './components/ProcessingCard';
import { ProcessingErrorCard } from './components/ProcessingErrorCard';
import { SavedFeedbackCard } from './components/SavedFeedbackCard';
import { UploadDropzoneArea } from './components/UploadDropzoneArea';
import { UploadFlowPanel } from './components/UploadFlowPanel';
import { UploadProgressSummary } from './components/UploadProgressSummary';
import { UploadResultPanel } from './components/UploadResultPanel';
import { generateDocumentId } from './mockData';
import { analyzePdf, AnalyzePdfRequestError, type AnalyzePdfResponse } from './services/analyzePdf';
import { confirmAnalysis } from './services/confirmAnalysis';
import { confirmUpdateDocumentVersion } from './services/confirmUpdateDocumentVersion';
import { getDocument } from '@/features/documents/api/documentsApi';
import { nextMajorVersionLabel } from '@/features/documents/utils/versionLabel';
import {
  useBulkUploadQueue,
  type BulkHistoryPayload,
  type BulkTerminalPayload,
} from './hooks/useBulkUploadQueue';
import { useWorkflowLogger } from './hooks/useWorkflowLogger';
import { useSemiDeterminateProgress, useSimulatedStepIndex } from './hooks/useProcessingProgress';
import {
  loadReviewWorkflowSettings,
  saveReviewWorkflowSettings,
  canAutoAcceptWithSettings,
  resolveEffectiveNamingForItem,
  resolveFinalFileNameForConfirm,
  shouldPauseForReview,
} from './utils/reviewWorkflowSettings';
import type { PerItemNamingChoice, WorkflowReviewSettings } from './types/reviewWorkflowSettings';
import type {
  DocumentHistoryItem,
  ExtractedMetadata,
  HistoryStatus,
  ProcessingLogItem,
  SendFlowPhase,
  UploadedDocument,
} from './types';
import {
  buildTrackingHref,
  deriveBulkUploadProgressState,
  deriveSingleFileUploadProgressState,
} from './utils/uploadProgress';
import type { WorkflowErrorDisplay } from './types/workflowError';
import {
  buildAnalysisDecision,
  createRequestId,
  formatDurationMs,
  mapProcessingLogsToWorkflowEvents,
} from './utils/workflowLogHelpers';
import { buildWorkflowErrorLogDetails, parseWorkflowErrorPayload } from './utils/workflowErrors';
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const updateTargetDocumentId = searchParams.get('documentId')?.trim() || null;
  const { isAuthenticated, roles, user, membership, tenant } = useAuth();
  const canShowWorkflowDebug = canViewDocumentTracking(roles, user?.role, membership?.status);
  const abortRef = useRef<AbortController | null>(null);
  const analysisGenerationRef = useRef(0);
  const autoConfirmTriggeredRef = useRef(false);
  const filesByDocIdRef = useRef<Map<string, File>>(new Map());
  const snapshotsRef = useRef<Record<string, AnalysisSnapshot>>({});
  const completingTimerRef = useRef<number | null>(null);

  const [flowPhase, setFlowPhase] = useState<SendFlowPhase>('idle');
  const [reviewSettings, setReviewSettings] = useState(loadReviewWorkflowSettings);
  const [perItemNaming, setPerItemNaming] = useState<PerItemNamingChoice>({
    namingMode: 'ai_suggested',
  });
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
  const [updateTargetLabel, setUpdateTargetLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!updateTargetDocumentId) return;
    navigate(`/biblioteca?updateVersion=${encodeURIComponent(updateTargetDocumentId)}`, {
      replace: true,
    });
  }, [navigate, updateTargetDocumentId]);

  useEffect(() => {
    if (!updateTargetDocumentId) {
      setUpdateTargetLabel(null);
      return;
    }

    let cancelled = false;
    void getDocument(updateTargetDocumentId)
      .then((detail) => {
        if (cancelled) return;
        const label =
          detail.document.currentVersionLabel ??
          detail.latestVersion?.versionLabel ??
          `v${detail.document.version}`;
        setUpdateTargetLabel(label);
      })
      .catch(() => {
        if (!cancelled) setUpdateTargetLabel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [updateTargetDocumentId]);

  const nextVersionLabel = useMemo(
    () => (updateTargetLabel ? nextMajorVersionLabel(updateTargetLabel) : null),
    [updateTargetLabel],
  );

  const workflow = useWorkflowLogger();
  const itemStartedAtRef = useRef<number | null>(null);

  const isProcessingView = flowPhase === 'analyzing' || flowPhase === 'completing';
  const isProcessingComplete = flowPhase === 'completing';
  const processingProgress = useSemiDeterminateProgress(isProcessingView, isProcessingComplete);
  const simulatedStepIndex = useSimulatedStepIndex(flowPhase === 'analyzing', isProcessingComplete);

  const clearCompletingTimer = useCallback(() => {
    if (completingTimerRef.current !== null) {
      window.clearTimeout(completingTimerRef.current);
      completingTimerRef.current = null;
    }
  }, []);

  const invalidateDocumentQueries = useCallback(() => {
    void invalidateLibraryQueries(queryClient, tenant?.tenantId);
  }, [queryClient, tenant?.tenantId]);

  const handleBulkItemSaved = useCallback(
    ({ item, autoSaved }: BulkHistoryPayload) => {
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
      invalidateDocumentQueries();
    },
    [workflow, invalidateDocumentQueries],
  );

  const handleBulkItemTerminal = useCallback(
    ({ item, autoSaved }: BulkTerminalPayload) => {
      if (item.status === 'saved') return;

      workflow.logItem(item.id, item.originalFileName, {
        level: item.status === 'error' ? 'error' : 'warning',
        stage: 'history',
        message: 'Item finalizado (visível nos logs do lote).',
        details: { finalStatus: item.status, autoSaved },
      });
    },
    [workflow],
  );

  const bulkQueue = useBulkUploadQueue({
    reviewSettings,
    onReviewSettingsChange: setReviewSettings,
    isAuthenticated,
    workflow,
    onItemSaved: handleBulkItemSaved,
    onItemTerminal: handleBulkItemTerminal,
  });

  const handleReviewSettingsChange = useCallback(
    (next: WorkflowReviewSettings) => {
      setReviewSettings(next);
      saveReviewWorkflowSettings(next);
      workflow.log({
        level: 'info',
        stage: 'auto',
        message: next.autoReviewEnabled
          ? `Configurações da revisão: Auto ligado (${next.autoAcceptDelaySeconds}s).`
          : 'Configurações da revisão atualizadas.',
        details: {
          defaultNamingPolicy: next.defaultNamingPolicy,
          aiRenameEnabled: next.aiRenameEnabled,
        },
      });
    },
    [workflow],
  );

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
    setPerItemNaming({ namingMode: 'ai_suggested' });
    setCurrentDocId(null);
    setIsConfirming(false);
    setAnalysisError(null);
  }, [clearCompletingTimer]);

  const processFile = useCallback(
    async (file: File) => {
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
      setPerItemNaming({ namingMode: 'ai_suggested' });
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
          documentId: updateTargetDocumentId ?? undefined,
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

        if (
          reviewSettings.autoReviewEnabled &&
          shouldPauseForReview(reviewSettings, { metadata, rawAnalysis: raw })
        ) {
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
          showDebug: false,
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
    },
    [clearCompletingTimer, reviewSettings, updateTargetDocumentId, workflow],
  );

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

      if (!rawAnalysis.classification.classId) {
        toast.error('Classificação ausente. Não é possível salvar.');
        return;
      }

      const effectiveNamingMode = resolveEffectiveNamingForItem(reviewSettings, perItemNaming);
      const resolvedFinalName = resolveFinalFileNameForConfirm({
        settings: reviewSettings,
        originalFileName: rawAnalysis.originalFileName,
        aiSuggestedFileName: rawAnalysis.recommendedFileName ?? rawAnalysis.originalFileName,
        perItem: perItemNaming,
      });

      if (resolvedFinalName === '—') {
        toast.error('Informe um nome válido para o arquivo.');
        return;
      }

      if (
        reviewSettings.aiRenameEnabled &&
        effectiveNamingMode === 'ai_suggested' &&
        !rawAnalysis.recommendedFileName
      ) {
        toast.error('Nome sugerido ausente. Não é possível salvar.');
        return;
      }

      setFlowPhase('saving');
      setIsConfirming(true);
      setAutoCountdown(null);

      workflow.logItem(currentDocId, lastProcessedFile.name, {
        level: 'info',
        stage: 'confirmation',
        message: options?.autoSaved
          ? 'Salvamento automático iniciado.'
          : 'Confirmação manual iniciada.',
      });

      const confirmStartedAt = Date.now();
      try {
        const confirmContext = {
          itemId: currentDocId,
          fileName: lastProcessedFile.name,
          requestId: createRequestId(),
        };
        const confirmOptions = {
          manualReviewConfirmed: requiresReview,
          namingMode: effectiveNamingMode,
          finalFileName: resolvedFinalName,
          selectedFileName: effectiveNamingMode === 'manual' ? perItemNaming.manualName : undefined,
          useAiNaming: reviewSettings.aiRenameEnabled && effectiveNamingMode !== 'original',
          context: confirmContext,
        };

        const result = updateTargetDocumentId
          ? await confirmUpdateDocumentVersion(rawAnalysis, {
              ...confirmOptions,
              documentId: updateTargetDocumentId,
              versionLabel: nextVersionLabel ?? undefined,
            })
          : await confirmAnalysis(rawAnalysis, confirmOptions);

        const savedMetadata: ExtractedMetadata = {
          ...activeMetadata,
          savedDocumentId: result.documentId,
          savedVersionId: result.versionId,
          suggestedVersion:
            'versionLabel' in result ? result.versionLabel : activeMetadata.suggestedVersion,
          documentCode:
            'documentCode' in result ? result.documentCode : activeMetadata.documentCode,
          storageStatus: result.storageStatus,
        };

        setActiveMetadata(savedMetadata);
        const actionLabel = options?.autoSaved ? 'Salvo automaticamente' : 'Metadados confirmados';

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
            details: { delaySeconds: reviewSettings.autoAcceptDelaySeconds },
          });
          toast.success('Documento salvo com sucesso');
        } else {
          setFlowPhase('completed');
          toast.success('Documento salvo com sucesso');
        }
        invalidateDocumentQueries();
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
    [
      activeMetadata,
      currentDocId,
      invalidateDocumentQueries,
      lastProcessedFile,
      manualReviewChecked,
      nextVersionLabel,
      perItemNaming,
      rawAnalysis,
      reviewSettings,
      updateTargetDocumentId,
      workflow,
    ],
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

  const requiresReview = activeMetadata?.analysisStatus === 'requires_review';
  const effectiveNamingMode = resolveEffectiveNamingForItem(reviewSettings, perItemNaming);
  const resolvedFinalName =
    rawAnalysis && activeMetadata
      ? resolveFinalFileNameForConfirm({
          settings: reviewSettings,
          originalFileName: rawAnalysis.originalFileName,
          aiSuggestedFileName: rawAnalysis.recommendedFileName ?? rawAnalysis.originalFileName,
          perItem: perItemNaming,
        })
      : '—';

  const hasValidAnalysis =
    Boolean(rawAnalysis?.classification.classId) &&
    (reviewSettings.aiRenameEnabled
      ? effectiveNamingMode !== 'manual' || resolvedFinalName !== '—'
      : Boolean(rawAnalysis?.originalFileName));

  const canConfirm =
    Boolean(activeMetadata) &&
    !activeMetadata?.savedDocumentId &&
    Boolean(rawAnalysis) &&
    hasValidAnalysis &&
    flowPhase !== 'error' &&
    (requiresReview ? manualReviewChecked : activeMetadata?.analysisStatus === 'completed') &&
    !(reviewSettings.defaultNamingPolicy === 'manual_required' && resolvedFinalName === '—');

  const autoEligible = canAutoAcceptWithSettings(reviewSettings, {
    isAuthenticated,
    metadata: activeMetadata,
    rawAnalysis,
    autoPaused,
    saved: Boolean(activeMetadata?.savedDocumentId),
  });

  useEffect(() => {
    if (!autoEligible || flowPhase !== 'completed' || autoConfirmTriggeredRef.current) {
      return;
    }

    setAutoCountdown(reviewSettings.autoAcceptDelaySeconds);
    workflow.log({
      level: 'info',
      stage: 'auto',
      message: `Contagem regressiva iniciada (${reviewSettings.autoAcceptDelaySeconds}s).`,
      itemId: currentDocId ?? undefined,
      fileName: lastProcessedFile?.name,
    });
  }, [
    autoEligible,
    currentDocId,
    flowPhase,
    lastProcessedFile,
    reviewSettings.autoAcceptDelaySeconds,
    workflow,
  ]);

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

    setReturnCountdown(reviewSettings.autoAcceptDelaySeconds);

    const timer = window.setTimeout(() => {
      resetToIdle();
    }, reviewSettings.autoAcceptDelaySeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [flowPhase, lastAutoSaved, resetToIdle, reviewSettings.autoAcceptDelaySeconds]);

  useEffect(() => {
    if (returnCountdown === null || returnCountdown <= 0 || flowPhase !== 'saved') return;

    const timer = window.setTimeout(() => {
      setReturnCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [returnCountdown, flowPhase]);

  const showProcessing = isProcessingView && lastProcessedFile;
  const showError = flowPhase === 'error' && lastProcessedFile && activeMetadata && currentDocId;
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

  const progressState = useMemo(() => {
    if (isBulkActive) {
      return deriveBulkUploadProgressState({
        batchPhase: bulkQueue.batchPhase,
        currentItem: bulkQueue.currentItem,
        statusMessage: bulkQueue.statusMessage,
        itemsCount: bulkQueue.items.length,
      });
    }

    return deriveSingleFileUploadProgressState({
      flowPhase,
      fileName: displayFileName || undefined,
      fileSize: displayFileSize || undefined,
      requiresReview,
      dynamicPercent: processingProgress,
      errorMessage: analysisError?.message ?? errorMessage,
      documentId: activeMetadata?.savedDocumentId ?? currentDocId,
      recentLogLabels: logs.map((log) => log.title).filter(Boolean),
    });
  }, [
    activeMetadata?.savedDocumentId,
    analysisError?.message,
    bulkQueue.batchPhase,
    bulkQueue.currentItem,
    bulkQueue.items.length,
    bulkQueue.statusMessage,
    currentDocId,
    displayFileName,
    displayFileSize,
    errorMessage,
    flowPhase,
    isBulkActive,
    logs,
    processingProgress,
    requiresReview,
  ]);

  const trackingHref = useMemo(
    () =>
      buildTrackingHref(
        progressState.documentId ?? activeMetadata?.savedDocumentId ?? currentDocId ?? undefined,
        analysisError?.requestId,
      ),
    [
      activeMetadata?.savedDocumentId,
      analysisError?.requestId,
      currentDocId,
      progressState.documentId,
    ],
  );

  const isResultView =
    !isBulkActive && (flowPhase === 'completed' || flowPhase === 'saving' || flowPhase === 'error');

  const progressSummary = (
    <UploadProgressSummary
      variant="embedded"
      state={progressState}
      canViewTracking={canShowWorkflowDebug}
      trackingHref={trackingHref}
      canShowTechnicalDetails={canShowWorkflowDebug}
      technicalDetails={
        analysisError
          ? buildWorkflowErrorLogDetails(analysisError, {
              endpoint: analysisError.endpoint,
              showDebug: false,
            })
          : undefined
      }
      technicalHint={analysisError?.devHint}
      onRetry={
        isBulkActive
          ? () => bulkQueue.reprocessItem()
          : flowPhase === 'error'
            ? handleReprocess
            : undefined
      }
      onViewDocument={!isBulkActive && flowPhase === 'saved' ? resetToIdle : undefined}
    />
  );

  const isIdleLayout = !isBulkActive && flowPhase === 'idle';

  return (
    <div className="flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-doqyn-border bg-doqyn-card px-3 py-2 text-caption text-doqyn-muted">
        <span>
          Esta tela de envio é o fluxo legado. O upload agora vive na Biblioteca — use o botão “+
          Novo” ou arraste arquivos para a janela.
        </span>
        <Link to="/biblioteca" className="shrink-0 font-medium text-doqyn-info hover:underline">
          Ir para a Biblioteca
        </Link>
      </div>
      <PageHeader
        className={cn('shrink-0', isResultView && 'mb-3 pb-3')}
        eyebrow={updateTargetDocumentId ? 'Atualização' : 'Processamento'}
        title={updateTargetDocumentId ? 'Atualizar documento' : 'Envio de Documentos'}
        description={
          updateTargetDocumentId
            ? `Nova versão do mesmo documento${nextVersionLabel ? ` (${nextVersionLabel})` : ''}. Versões anteriores são preservadas.`
            : 'Envie um PDF textual para análise automática. Nomes e metadados são gerados após o processamento.'
        }
        actions={
          <ReviewWorkflowSettingsPanel
            settings={reviewSettings}
            onChange={handleReviewSettingsChange}
            disabled={
              flowPhase === 'analyzing' ||
              flowPhase === 'completing' ||
              flowPhase === 'saving' ||
              bulkQueue.batchPhase === 'running'
            }
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            isIdleLayout && 'items-center justify-start overflow-auto py-1',
          )}
        >
          {isBulkActive ? (
            <UploadFlowPanel
              className="min-h-0 w-full flex-1"
              contentClassName="min-h-0 flex-1 overflow-hidden"
              progress={progressSummary}
            >
              <BulkBatchPanel
                embedded
                className="h-full min-h-0"
                items={bulkQueue.items}
                batchPhase={bulkQueue.batchPhase}
                currentItem={bulkQueue.currentItem}
                autoCountdown={bulkQueue.autoCountdown}
                statusMessage={bulkQueue.statusMessage}
                reviewSettings={bulkQueue.batchReviewSettings ?? reviewSettings}
                isAuthenticated={isAuthenticated}
                selectedItemId={workflow.selectedItemId}
                onSelectItem={workflow.setSelectedItemId}
                onPerItemNamingChange={bulkQueue.updateItemNaming}
                onConfirmContinue={(itemId) => void bulkQueue.confirmItemAndContinue(itemId)}
                onCancelAuto={bulkQueue.cancelAutoCountdown}
                onSkip={bulkQueue.skipItem}
                onReprocess={bulkQueue.reprocessItem}
                onPause={bulkQueue.pauseBatch}
                onResume={bulkQueue.resumeBatch}
                onCancel={bulkQueue.cancelBatch}
                onNewBatch={bulkQueue.resetBatch}
                onClearCompleted={bulkQueue.clearCompleted}
              />
            </UploadFlowPanel>
          ) : (
            <UploadFlowPanel
              centered={isIdleLayout}
              className={cn('w-full', isIdleLayout ? 'max-w-2xl shrink-0' : 'min-h-0 flex-1')}
              contentClassName={!isIdleLayout ? 'min-h-0 flex-1 overflow-hidden' : undefined}
              progress={progressSummary}
            >
              {flowPhase === 'idle' && (
                <UploadDropzoneArea
                  onFilesSelected={handleFilesSelected}
                  onValidationError={(msg) => toast.error(msg)}
                />
              )}

              {(showProcessing || showError || showResult) && (
                <div className="flex min-h-0 flex-1 flex-col">
                  {showProcessing && (
                    <ProcessingCard
                      embedded
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
                      embedded
                      className="min-h-0 flex-1"
                      fileName={displayFileName}
                      fileSize={displayFileSize}
                      title={analysisError?.title}
                      message={errorMessage}
                      suggestion={analysisError?.suggestion}
                      action={analysisError?.action}
                      devHint={analysisError?.devHint}
                      showDebug={false}
                      debugDetails={
                        analysisError
                          ? buildWorkflowErrorLogDetails(analysisError, {
                              endpoint: analysisError.endpoint,
                              showDebug: false,
                            })
                          : undefined
                      }
                      onRetry={handleReprocess}
                      onChooseAnother={resetToIdle}
                    />
                  )}

                  {showResult && (
                    <UploadResultPanel
                      embedded
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
                      autoReviewEnabled={reviewSettings.autoReviewEnabled}
                      onCancelAuto={handleCancelAuto}
                      onManualReview={handleManualReview}
                      originalFileName={rawAnalysis?.originalFileName ?? displayFileName}
                      aiSuggestedFileName={rawAnalysis?.recommendedFileName ?? displayFileName}
                      reviewSettings={reviewSettings}
                      perItemNaming={perItemNaming}
                      onPerItemNamingChange={setPerItemNaming}
                    />
                  )}
                </div>
              )}

              {flowPhase === 'saved' && (
                <SavedFeedbackCard
                  embedded
                  autoSaved={lastAutoSaved}
                  returnCountdown={returnCountdown}
                />
              )}
            </UploadFlowPanel>
          )}
        </div>
      </div>
    </div>
  );
}
