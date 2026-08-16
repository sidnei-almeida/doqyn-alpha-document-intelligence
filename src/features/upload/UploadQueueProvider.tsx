import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { canConfirmDocumentMetadata } from '@/lib/documentAdminAccess';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';
import { isDocumentCategoryId } from '@/lib/entityIds';
import { createRequestId } from '@/features/document-send/utils/workflowLogHelpers';
import { validateConfirmableAnalysis } from '@/features/document-send/services/normalizeConfirmPayload';
import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import {
  resolveEffectiveNamingForItem,
  resolveFinalFileNameForConfirm,
} from '@/features/document-send/utils/reviewWorkflowSettings';
import type { UploadContext, UploadQueueItem } from './types';
import { analyzePdf, isAnalysisStillRunningError } from './services/analyzePdf';
import { confirmAnalysis, submitUploadForApproval } from './services/confirmAnalysis';
import { prepareUploadItems } from './services/startUploadFromFiles';
import { UploadQueueContext, type AutoConfirmCountdown, type UploadQueueContextValue } from './uploadQueueContext';
import { isUploadAutoConfirmEnabled } from './config/uploadAutoConfirm';
import { getUploadAnalysisConcurrency } from './config/uploadConcurrency';
import { resolveQueueAnalysisAction } from './config/resolveQueueAnalysisAction';
import { useReviewWorkflowSettingsState } from './hooks/useReviewWorkflowSettingsState';
import {
  analysisFailureMessage,
  needsManualReviewConfirmation,
  UPLOAD_ANALYZE_MAX_WAIT_MS,
  uploadAnalyzeStillRunningMessage,
} from './queue/uploadQueueAnalysis';
import {
  normalizeUploadQueueAnalysis,
  startCountdownSeconds,
  type CountdownHandle,
} from './queue/uploadQueueCore';
import { logUploadDev } from './utils/uploadDevLog';
import {
  countPendingItems,
  nextQueuedItemExcluding,
  uploadQueueReducer,
} from './queue/uploadQueueState';

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated, tenant, user, hasAnyRole } = useAuth();
  const { settings: reviewSettings, setSettings: updateReviewSettings } = useReviewWorkflowSettingsState();

  const [items, dispatch] = useReducer(uploadQueueReducer, []);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);
  const [autoConfirmCountdown, setAutoConfirmCountdown] = useState<AutoConfirmCountdown | null>(null);

  const filesRef = useRef(new Map<string, File>());
  const itemsRef = useRef(items);
  const countdownHandleRef = useRef<CountdownHandle | null>(null);
  const autoPausedRef = useRef(new Set<string>());
  /**
   * Análises em voo, uma entrada por arquivo. Antes era um id só, e era esse "um só" que serializava
   * o lote inteiro: enquanto um arquivo esperava a Groq, nenhum outro saía do navegador.
   */
  const inFlightAnalysesRef = useRef(
    new Map<string, { controller: AbortController; timeout: ReturnType<typeof setTimeout> }>(),
  );
  /**
   * Espera da contagem regressiva do auto-confirmar, em ordem de chegada. A contagem é uma só na
   * tela; o que passou a ser paralelo é a análise, não a decisão.
   */
  const pendingAutoConfirmRef = useRef<string[]>([]);
  const pumpQueueRef = useRef<() => void>(() => undefined);
  itemsRef.current = items;

  const deployAutoConfirm = isUploadAutoConfirmEnabled();

  const isDocumentAdmin = canConfirmDocumentMetadata(hasAnyRole);

  const invalidateLibrary = useCallback(async () => {
    await invalidateLibraryQueries(queryClient, tenant?.tenantId ?? user?.companyId);
  }, [queryClient, tenant?.tenantId, user?.companyId]);

  const clearAutoTimer = useCallback(() => {
    countdownHandleRef.current?.cancel();
    countdownHandleRef.current = null;
  }, []);

  /** Encerra o acompanhamento de uma análise: some o timeout e a vaga volta para a fila. */
  const finishAnalysis = useCallback((itemId: string) => {
    const inFlight = inFlightAnalysesRef.current.get(itemId);
    if (!inFlight) return false;
    clearTimeout(inFlight.timeout);
    inFlightAnalysesRef.current.delete(itemId);
    return true;
  }, []);

  const abortAnalysis = useCallback(
    (itemId: string) => {
      const inFlight = inFlightAnalysesRef.current.get(itemId);
      if (!inFlight) return;
      inFlight.controller.abort();
      finishAnalysis(itemId);
    },
    [finishAnalysis],
  );

  const abortAllAnalyses = useCallback(() => {
    for (const [, inFlight] of inFlightAnalysesRef.current) {
      clearTimeout(inFlight.timeout);
      inFlight.controller.abort();
    }
    inFlightAnalysesRef.current.clear();
  }, []);

  const tryPumpQueue = useCallback(() => {
    queueMicrotask(() => {
      if (inFlightAnalysesRef.current.size >= getUploadAnalysisConcurrency()) return;
      const excluded = new Set(inFlightAnalysesRef.current.keys());
      if (!nextQueuedItemExcluding(itemsRef.current, excluded)) return;
      pumpQueueRef.current();
    });
  }, []);

  const notifySavedDocument = useCallback(
    (item: UploadQueueItem, resolvedFinalName: string) => {
      const savedClassId = item.analysis?.raw.classification.classId;
      const savedClassName =
        item.analysis?.raw.classification.className ??
        item.analysis?.metadata.documentType ??
        'outra pasta';
      const uploadSpaceId = item.context?.categoryId;
      const folderTargetId = [uploadSpaceId, savedClassId].find(
        (id): id is string => Boolean(id && isDocumentCategoryId(id)),
      );

      // Só avisa quando a IA mandou o arquivo para uma pasta diferente da escolhida no envio —
      // aí o aviso carrega informação nova e o atalho para conferir. No caso normal a fila de
      // upload já mostra "Salvo na Biblioteca" no próprio arquivo; repetir isso num aviso com o
      // nome inteiro do arquivo era ruído em cima de ruído.
      if (uploadSpaceId && savedClassId && uploadSpaceId !== savedClassId) {
        toast.success(`Salvo em ${savedClassName}.`, {
          description: resolvedFinalName,
          action: folderTargetId
            ? {
                label: 'Abrir pasta',
                onClick: () =>
                  navigate(`/biblioteca?space=${encodeURIComponent(folderTargetId)}`),
              }
            : undefined,
        });
      }
    },
    [navigate],
  );

  const startUploadFromFiles = useCallback((files: File[], context?: UploadContext) => {
    const pending = countPendingItems(itemsRef.current);
    const prepared = prepareUploadItems(files, context, pending);
    if (!prepared.ok) {
      toast.error(prepared.error);
      return;
    }
    for (const item of prepared.items) {
      filesRef.current.set(item.id, item.file);
    }
    dispatch({
      type: 'enqueue',
      items: prepared.items.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        fileSize: item.fileSize,
        status: item.status,
        context: item.context,
      })),
    });
  }, []);

  const confirmItem = useCallback(
    async (item: UploadQueueItem, manualReviewConfirmed: boolean, perItem?: PerItemNamingChoice) => {
      if (!item.analysis) return;

      const { raw, metadata } = item.analysis;
      const validationError = validateConfirmableAnalysis(raw);
      if (validationError) {
        dispatch({ type: 'error', id: item.id, message: validationError });
        toast.error(validationError);
        return;
      }

      const namingChoice = perItem ?? item.namingChoice;
      const effectiveNamingMode = resolveEffectiveNamingForItem(reviewSettings, namingChoice);
      const resolvedFinalName = resolveFinalFileNameForConfirm({
        settings: reviewSettings,
        originalFileName: raw.originalFileName,
        aiSuggestedFileName: raw.recommendedFileName ?? raw.originalFileName,
        perItem: namingChoice,
      });

      if (resolvedFinalName === '—') {
        const message = 'Informe um nome válido para o arquivo.';
        dispatch({ type: 'error', id: item.id, message });
        toast.error(message);
        return;
      }

      dispatch({ type: 'status', id: item.id, status: 'confirming' });
      clearAutoTimer();
      setAutoConfirmCountdown(null);

      logUploadDev('confirm:start', {
        fileName: item.fileName,
        jobId: raw.jobId,
        classId: raw.classification.classId,
        finalFileName: resolvedFinalName,
        manualReviewConfirmed,
      });

      try {
        const confirmOptions = {
          manualReviewConfirmed,
          namingMode: effectiveNamingMode,
          finalFileName: resolvedFinalName,
          selectedFileName: effectiveNamingMode === 'manual' ? namingChoice?.manualName : undefined,
          useAiNaming: reviewSettings.aiRenameEnabled && effectiveNamingMode !== 'original',
          context: {
            itemId: item.id,
            fileName: item.fileName,
            requestId: createRequestId(),
          },
        } as const;

        if (isDocumentAdmin) {
          const result = await confirmAnalysis(raw, confirmOptions);
          dispatch({ type: 'done', id: item.id, documentId: result.documentId });
          filesRef.current.delete(item.id);
          setReviewItemId((current) => (current === item.id ? null : current));
          logUploadDev('confirm:success', {
            documentId: result.documentId,
            versionId: result.versionId,
            classId: raw.classification.classId,
            status: result.status,
            storageStatus: result.storageStatus,
          });
          await invalidateLibrary();
          notifySavedDocument({ ...item, analysis: { metadata, raw } }, resolvedFinalName);
        } else {
          const result = await submitUploadForApproval(raw, confirmOptions);
          dispatch({ type: 'awaiting_approval', id: item.id, approvalId: result.approvalId });
          filesRef.current.delete(item.id);
          setReviewItemId((current) => (current === item.id ? null : current));
          await queryClient.invalidateQueries({ queryKey: ['audit-pending'] });
          toast.success(
            `"${resolvedFinalName}" enviado para aprovação. Um administrador revisará na Auditoria.`,
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível salvar o documento.';
        dispatch({ type: 'error', id: item.id, message });
        toast.error(message);
      } finally {
        tryPumpQueue();
      }
    },
    [reviewSettings, invalidateLibrary, clearAutoTimer, notifySavedDocument, tryPumpQueue, isDocumentAdmin, queryClient],
  );

  const scheduleAutoConfirmRef = useRef<(item: UploadQueueItem, manual: boolean) => void>(
    () => undefined,
  );

  /**
   * Passa a vez para o próximo arquivo que ficou esperando contagem regressiva.
   *
   * Chamado assim que a contagem atual termina — não quando o `confirmAnalysis` responde. Esperar a
   * gravação para começar a próxima contagem devolveria em série justamente o que este trabalho
   * tirou de série.
   */
  const startNextPendingAutoConfirm = useCallback(() => {
    while (pendingAutoConfirmRef.current.length > 0) {
      const nextId = pendingAutoConfirmRef.current.shift();
      if (!nextId) return;
      if (autoPausedRef.current.has(nextId)) continue;

      const nextItem = itemsRef.current.find((entry) => entry.id === nextId);
      if (!nextItem?.analysis || nextItem.status !== 'review') continue;

      scheduleAutoConfirmRef.current(nextItem, false);
      return;
    }
  }, []);

  const scheduleAutoConfirm = useCallback(
    (item: UploadQueueItem, manualReviewConfirmed: boolean) => {
      const delaySeconds = reviewSettings.autoAcceptDelaySeconds;

      if (!reviewSettings.autoReviewEnabled || delaySeconds <= 0) {
        void confirmItem(item, manualReviewConfirmed, item.namingChoice);
        return;
      }

      // Uma contagem por vez: a tela mostra um relógio só, e dois relógios correndo juntos seriam
      // duas decisões automáticas que o usuário não consegue acompanhar. Os outros ficam visíveis
      // como revisão pendente e entram por ordem de chegada.
      if (countdownHandleRef.current) {
        dispatch({ type: 'status', id: item.id, status: 'review' });
        if (!pendingAutoConfirmRef.current.includes(item.id)) {
          pendingAutoConfirmRef.current.push(item.id);
        }
        return;
      }

      autoPausedRef.current.delete(item.id);
      setAutoConfirmCountdown({ itemId: item.id, secondsLeft: delaySeconds });
      dispatch({ type: 'status', id: item.id, status: 'review' });

      clearAutoTimer();
      const countdown = startCountdownSeconds(
        delaySeconds,
        (remaining) => {
          if (remaining > 0) {
            setAutoConfirmCountdown({ itemId: item.id, secondsLeft: remaining });
          }
        },
        () => !autoPausedRef.current.has(item.id),
      );
      countdownHandleRef.current = countdown;

      void countdown.completed.then((finished) => {
        if (countdownHandleRef.current === countdown) {
          countdownHandleRef.current = null;
        }
        setAutoConfirmCountdown(null);

        if (finished) {
          const current = itemsRef.current.find((entry) => entry.id === item.id);
          if (current?.analysis) {
            void confirmItem(current, manualReviewConfirmed, current.namingChoice);
          }
        }

        startNextPendingAutoConfirm();
      });
    },
    [reviewSettings, confirmItem, clearAutoTimer, startNextPendingAutoConfirm],
  );

  useEffect(() => {
    scheduleAutoConfirmRef.current = scheduleAutoConfirm;
  }, [scheduleAutoConfirm]);

  const analyzeQueuedItem = useCallback(async (next: UploadQueueItem) => {
    const file = filesRef.current.get(next.id);
    if (!file) {
      dispatch({ type: 'error', id: next.id, message: 'Arquivo indisponível. Tente novamente.' });
      tryPumpQueue();
      return;
    }

    logUploadDev('analyze:start', {
      fileName: next.fileName,
      size: next.fileSize,
      contextCategoryId: next.context?.categoryId ?? null,
    });

    dispatch({ type: 'status', id: next.id, status: 'analyzing' });

    const analyzeController = new AbortController();
    // Rede de segurança do laço de consulta, não prazo de erro: se o acompanhamento não se encerrar
    // sozinho, o item vira "continua no servidor" — nunca vermelho.
    const timeout = setTimeout(() => {
      if (!inFlightAnalysesRef.current.has(next.id)) return;
      abortAnalysis(next.id);
      dispatch({ type: 'still_running', id: next.id, message: uploadAnalyzeStillRunningMessage() });
      tryPumpQueue();
    }, UPLOAD_ANALYZE_MAX_WAIT_MS + 30_000);

    inFlightAnalysesRef.current.set(next.id, { controller: analyzeController, timeout });

    try {
      const result = await analyzePdf(file, {
        signal: analyzeController.signal,
        context: { fileName: next.fileName },
        onQueueStatus: (queueStatus) => {
          if (!inFlightAnalysesRef.current.has(next.id)) return;
          dispatch({ type: 'queue_status', id: next.id, queueStatus });
        },
      });

      // Deixou de estar em voo enquanto a resposta vinha: expirou, foi cancelado ou o arquivo saiu
      // da fila. O resultado não vale mais.
      if (!finishAnalysis(next.id)) return;

      const analysis = normalizeUploadQueueAnalysis(result.metadata, result.raw);
      dispatch({ type: 'analysis', id: next.id, analysis });

      logUploadDev('analyze:success', {
        fileName: next.fileName,
        jobId: result.raw.jobId,
        classId: result.raw.classification.classId,
        requiresReview:
          result.raw.classification.requiresReview ||
          (result.raw.extraction?.requiresReview ?? false),
        autoConfirmEnabled: deployAutoConfirm,
      });

      const action = resolveQueueAnalysisAction(reviewSettings, analysis.metadata, result.raw, {
        deployAutoConfirm,
        isAuthenticated,
      });

      logUploadDev('analyze-routing', {
        action,
        autoConfirmEnabled: deployAutoConfirm,
        analysisStatus: result.raw.status,
      });

      const currentItem = itemsRef.current.find((entry) => entry.id === next.id) ?? next;
      const enrichedItem: UploadQueueItem = { ...currentItem, analysis };

      if (action === 'auto_confirm') {
        scheduleAutoConfirm(enrichedItem, false);
        // A vaga da análise já foi devolvida acima: o próximo arquivo sai enquanto este espera a
        // contagem e a gravação. Era exatamente esse encadeamento que serializava o lote.
        tryPumpQueue();
        return;
      }

      // Os dois casos abaixo estacionam o arquivo e **seguem com o lote**. O que espera decisão
      // humana sai da esteira; quem está limpo não paga por ele.
      if (action === 'open_review') {
        dispatch({ type: 'status', id: next.id, status: 'review' });
        setReviewItemId((current) => current ?? next.id);
        toast.info('Análise concluída. Revise e confirme para salvar na Biblioteca.', {
          action: {
            label: 'Revisar',
            onClick: () => setReviewItemId(next.id),
          },
        });
        tryPumpQueue();
        return;
      }

      if (action === 'ai_pause') {
        const message = analysisFailureMessage(result.raw.status, result.raw.errorCode);
        dispatch({ type: 'ai_pause', id: next.id, message });
        toast.warning(message);
        tryPumpQueue();
        return;
      }

      dispatch({
        type: 'error',
        id: next.id,
        message: analysisFailureMessage(result.raw.status, result.raw.errorCode),
      });
      tryPumpQueue();
    } catch (error) {
      // Cancelado por fora (rede de segurança ou o arquivo saiu da fila) já foi tratado lá.
      if (!finishAnalysis(next.id)) return;

      // Espera longa não é falha: o documento continua sendo analisado no servidor e chega na
      // Biblioteca sozinho. Marcar erro aqui convida ao reenvio, que só aumenta a fila.
      if (isAnalysisStillRunningError(error)) {
        dispatch({ type: 'still_running', id: next.id, message: error.message });
        tryPumpQueue();
        return;
      }

      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? uploadAnalyzeStillRunningMessage()
          : error instanceof Error
            ? error.message
            : 'Erro ao analisar o documento.';
      dispatch({ type: 'error', id: next.id, message });
      tryPumpQueue();
    }
  }, [
    reviewSettings,
    deployAutoConfirm,
    isAuthenticated,
    scheduleAutoConfirm,
    abortAnalysis,
    finishAnalysis,
    tryPumpQueue,
  ]);

  /**
   * Despacha análises até encher as vagas.
   *
   * O laço é síncrono de propósito: `dispatch` só repinta a lista depois, então os itens já
   * despachados nesta rodada saem pela exclusão, não pelo status.
   */
  const pumpQueue = useCallback(() => {
    const maxInFlight = getUploadAnalysisConcurrency();
    // Também segura o arquivo que falhou antes de ocupar vaga (sumiu do `filesRef`): sem isso o
    // laço reencontraria o mesmo item `queued` para sempre.
    const dispatched = new Set<string>();

    while (inFlightAnalysesRef.current.size < maxInFlight) {
      const excluded = new Set([...inFlightAnalysesRef.current.keys(), ...dispatched]);
      const next = nextQueuedItemExcluding(itemsRef.current, excluded);
      if (!next) return;

      dispatched.add(next.id);
      void analyzeQueuedItem(next);
    }
  }, [analyzeQueuedItem]);

  useEffect(() => {
    pumpQueueRef.current = () => {
      void pumpQueue();
    };
  }, [pumpQueue]);

  useEffect(() => {
    if (items.some((item) => item.status === 'queued')) {
      tryPumpQueue();
    }
  }, [items, tryPumpQueue]);

  useEffect(() => {
    if (!autoConfirmCountdown) {
      tryPumpQueue();
    }
  }, [autoConfirmCountdown, tryPumpQueue]);

  useEffect(
    () => () => {
      clearAutoTimer();
      abortAllAnalyses();
    },
    [clearAutoTimer, abortAllAnalyses],
  );

  const confirmReview = useCallback(
    async (itemId: string, perItem?: PerItemNamingChoice) => {
      const item = itemsRef.current.find((entry) => entry.id === itemId);
      if (!item || !item.analysis) return;

      const manualReviewConfirmed = needsManualReviewConfirmation(
        item.analysis.metadata,
        item.analysis.raw,
      );
      setReviewItemId(null);
      clearAutoTimer();
      setAutoConfirmCountdown(null);
      await confirmItem(item, manualReviewConfirmed, perItem ?? item.namingChoice);
    },
    [confirmItem, clearAutoTimer],
  );

  const setItemNamingChoice = useCallback((itemId: string, choice: PerItemNamingChoice) => {
    dispatch({ type: 'naming', id: itemId, choice });
  }, []);

  const cancelAutoConfirm = useCallback(
    (itemId: string) => {
      autoPausedRef.current.add(itemId);
      clearAutoTimer();
      setAutoConfirmCountdown(null);
      setReviewItemId(itemId);
      // Quem estava esperando a vez não pode ficar preso à decisão que o usuário assumiu.
      startNextPendingAutoConfirm();
    },
    [clearAutoTimer, startNextPendingAutoConfirm],
  );

  const retryItem = useCallback((itemId: string) => {
    dispatch({ type: 'retry', id: itemId });
  }, []);

  const removeItem = useCallback(
    (itemId: string) => {
      filesRef.current.delete(itemId);
      autoPausedRef.current.delete(itemId);
      pendingAutoConfirmRef.current = pendingAutoConfirmRef.current.filter((id) => id !== itemId);
      abortAnalysis(itemId);
      if (autoConfirmCountdown?.itemId === itemId) {
        clearAutoTimer();
        setAutoConfirmCountdown(null);
        startNextPendingAutoConfirm();
      }
      setReviewItemId((current) => (current === itemId ? null : current));
      dispatch({ type: 'remove', id: itemId });
      tryPumpQueue();
    },
    [
      autoConfirmCountdown,
      clearAutoTimer,
      abortAnalysis,
      startNextPendingAutoConfirm,
      tryPumpQueue,
    ],
  );

  const clearFinished = useCallback(() => {
    dispatch({ type: 'clear-finished' });
  }, []);

  const value = useMemo<UploadQueueContextValue>(
    () => ({
      items,
      pendingCount: countPendingItems(items),
      reviewItemId,
      reviewSettings,
      autoConfirmCountdown,
      updateReviewSettings,
      startUploadFromFiles,
      openReview: setReviewItemId,
      closeReview: () => setReviewItemId(null),
      confirmReview,
      setItemNamingChoice,
      cancelAutoConfirm,
      retryItem,
      removeItem,
      clearFinished,
    }),
    [
      items,
      reviewItemId,
      reviewSettings,
      autoConfirmCountdown,
      updateReviewSettings,
      startUploadFromFiles,
      confirmReview,
      setItemNamingChoice,
      cancelAutoConfirm,
      retryItem,
      removeItem,
      clearFinished,
    ],
  );

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}
