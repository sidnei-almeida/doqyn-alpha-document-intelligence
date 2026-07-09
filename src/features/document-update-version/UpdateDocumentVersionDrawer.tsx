import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { getDocument, listDocumentVersions } from '@/features/documents/api/documentsApi';
import { nextMajorVersionLabel } from '@/features/documents/utils/versionLabel';
import { analyzePdf } from '@/features/document-send/services/analyzePdf';
import { confirmUpdateDocumentVersion } from '@/features/document-send/services/confirmUpdateDocumentVersion';
import { createRequestId } from '@/features/document-send/utils/workflowLogHelpers';
import { ConfirmNewVersionActions } from './components/ConfirmNewVersionActions';
import { CurrentDocumentSummaryCard } from './components/CurrentDocumentSummaryCard';
import { CurrentMetadataPanel } from './components/CurrentMetadataPanel';
import { NewVersionAnalyzingPanel } from './components/NewVersionAnalyzingPanel';
import { NewVersionReviewStep } from './components/NewVersionReviewStep';
import { NewVersionUploadDropzone } from './components/NewVersionUploadDropzone';
import { UpdateDocumentVersionHeader } from './components/UpdateDocumentVersionHeader';
import { VersionHistorySummary } from './components/VersionHistorySummary';
import type {
  UpdateVersionAnalysisResult,
  UpdateVersionFlowPhase,
  UpdateVersionSuccess,
} from './types';
import { metadataRecordToDisplayFields } from './utils/documentMetadataDisplay';
import { invalidateDocumentUpdateQueries } from './utils/invalidateDocumentUpdateQueries';
import { buildVersionComparisonRows } from './utils/versionComparison';

type UpdateDocumentVersionDrawerProps = {
  documentId: string | null;
  onClose: () => void;
  onSuccess?: (result: UpdateVersionSuccess) => void;
};

export function UpdateDocumentVersionDrawer({
  documentId,
  onClose,
  onSuccess,
}: UpdateDocumentVersionDrawerProps) {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<UpdateVersionFlowPhase>('loading');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<UpdateVersionAnalysisResult | null>(null);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<UpdateVersionSuccess | null>(null);

  const detailQuery = useQuery({
    queryKey: ['document-detail', tenant?.tenantId, documentId],
    enabled: Boolean(documentId),
    queryFn: () => getDocument(documentId!),
    staleTime: 15_000,
  });

  const versionsQuery = useQuery({
    queryKey: ['document-versions', documentId],
    enabled: Boolean(documentId),
    queryFn: () => listDocumentVersions(documentId!),
    staleTime: 15_000,
  });

  const detail = detailQuery.data;
  const versions = versionsQuery.data?.versions ?? detail?.versions ?? [];
  const canUpdate = detail?.permissions?.canUpdate === true;

  const currentVersionLabel = useMemo(() => {
    if (!detail) return 'v1.0';
    return (
      detail.document.currentVersionLabel ??
      detail.latestVersion?.versionLabel ??
      versionsQuery.data?.currentVersionLabel ??
      `v${detail.document.version ?? 1}.0`
    );
  }, [detail, versionsQuery.data?.currentVersionLabel]);

  const nextVersionLabel = useMemo(
    () => nextMajorVersionLabel(currentVersionLabel),
    [currentVersionLabel],
  );

  const metadataFields = useMemo(
    () => metadataRecordToDisplayFields(detail?.metadata),
    [detail?.metadata],
  );

  const comparisonRows = useMemo(() => {
    if (!detail || !analysis) return [];
    return buildVersionComparisonRows({
      detail,
      analysis: analysis.raw,
      nextVersionLabel,
    });
  }, [analysis, detail, nextVersionLabel]);

  const resetFlow = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSelectedFile(null);
    setAnalysis(null);
    setReviewChecked(false);
    setErrorMessage(null);
    setSuccessResult(null);
    setPhase('ready');
  }, []);

  useEffect(() => {
    if (!documentId) return;
    resetFlow();
    setPhase('loading');
  }, [documentId, resetFlow]);

  useEffect(() => {
    if (!documentId) return;
    if (detailQuery.isLoading || versionsQuery.isLoading) {
      setPhase('loading');
      return;
    }
    if (detailQuery.isError || versionsQuery.isError || !detail) {
      setPhase('error');
      setErrorMessage('Não foi possível carregar os dados do documento.');
      return;
    }
    if (!canUpdate) {
      setPhase('error');
      setErrorMessage('Você não tem permissão para atualizar este documento.');
      return;
    }
    if (phase === 'loading' || phase === 'error') {
      setPhase('ready');
      setErrorMessage(null);
    }
  }, [
    canUpdate,
    detail,
    detailQuery.isError,
    detailQuery.isLoading,
    documentId,
    phase,
    versionsQuery.isError,
    versionsQuery.isLoading,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'analyzing' && phase !== 'confirming') {
        onClose();
      }
    };
    if (documentId) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [documentId, onClose, phase]);

  const runAnalysis = useCallback(
    async (file: File) => {
      if (!documentId || !detail) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSelectedFile(file);
      setAnalysis(null);
      setReviewChecked(false);
      setPhase('analyzing');
      setErrorMessage(null);

      try {
        const response = await analyzePdf(file, {
          documentId,
          signal: controller.signal,
          context: {
            itemId: documentId,
            fileName: file.name,
            requestId: createRequestId(),
          },
        });

        setAnalysis({
          file,
          metadata: response.metadata,
          raw: response.raw,
        });
        setReviewChecked(false);
        setPhase('review');
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : 'Não foi possível analisar o arquivo enviado.';
        setErrorMessage(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [detail, documentId],
  );

  const handleFileSelected = useCallback(
    (file: File) => {
      void runAnalysis(file);
    },
    [runAnalysis],
  );

  const handleConfirm = useCallback(async () => {
    if (!documentId || !analysis || !detail) return;

    const requiresReview = analysis.metadata.analysisStatus === 'requires_review';
    if (requiresReview && !reviewChecked) {
      toast.error('Confirme a revisão dos metadados antes de continuar.');
      return;
    }

    setPhase('confirming');
    setErrorMessage(null);

    try {
      const result = await confirmUpdateDocumentVersion(analysis.raw, {
        documentId,
        versionLabel: nextVersionLabel,
        manualReviewConfirmed: requiresReview,
        namingMode: 'ai_suggested',
        useAiNaming: true,
        context: {
          itemId: documentId,
          fileName: analysis.file.name,
          requestId: createRequestId(),
        },
      });

      const success: UpdateVersionSuccess = {
        documentId: result.documentId,
        versionId: result.versionId,
        versionLabel: result.versionLabel,
      };

      setSuccessResult(success);
      setPhase('success');
      await invalidateDocumentUpdateQueries(queryClient, tenant?.tenantId, documentId);
      onSuccess?.(success);
      toast.success(`Nova versão ${result.versionLabel} criada com sucesso.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível criar a nova versão.';
      setErrorMessage(message);
      setPhase('error');
      toast.error(message);
    }
  }, [
    analysis,
    detail,
    documentId,
    nextVersionLabel,
    onSuccess,
    queryClient,
    reviewChecked,
    tenant?.tenantId,
  ]);

  if (!documentId) return null;

  const requiresReview = analysis?.metadata.analysisStatus === 'requires_review';
  const canConfirm = Boolean(analysis) && (!requiresReview || reviewChecked);

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end modal-overlay-scrim backdrop-blur-[1px]"
      role="presentation"
      data-testid="update-version-drawer-overlay"
      onClick={() => {
        if (phase !== 'analyzing' && phase !== 'confirming') onClose();
      }}
    >
      <aside
        className="drawer-enter-right flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-doqyn-border-subtle bg-doqyn-surface shadow-dropdown"
        aria-labelledby="update-document-version-title"
        data-testid="update-version-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        {detail && (
          <UpdateDocumentVersionHeader
            document={detail.document}
            currentVersionLabel={currentVersionLabel}
            nextVersionLabel={nextVersionLabel}
            onClose={onClose}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {phase === 'loading' && (
            <p className="px-5 py-8 text-center text-[13px] text-doqyn-muted">
              Carregando documento e histórico de versões...
            </p>
          )}

          {phase === 'error' && (
            <div className="px-5 py-4">
              <div className="rounded-xl border border-doqyn-danger/30 bg-doqyn-danger/5 p-4">
                <p className="text-[13px] font-medium text-doqyn-danger">Não foi possível continuar</p>
                <p className="mt-1 text-[12px] text-doqyn-text">
                  {errorMessage ?? 'Erro desconhecido.'}
                </p>
              </div>
            </div>
          )}

          {phase === 'success' && successResult && (
            <div className="px-5 py-4">
              <div
                className="rounded-xl border border-doqyn-success/30 bg-doqyn-success/5 p-4"
                data-testid="update-version-success"
              >
                <p className="text-[13px] font-medium text-doqyn-success">Nova versão criada</p>
                <p className="mt-1 text-[12px] text-doqyn-text">
                  O documento foi atualizado para{' '}
                  <span className="font-medium">{successResult.versionLabel}</span>. Versões anteriores
                  permanecem no histórico.
                </p>
              </div>
            </div>
          )}

          {detail && !['loading', 'success'].includes(phase) && phase !== 'error' && (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {phase === 'review' || phase === 'confirming' ? (
                analysis && (
                  <NewVersionReviewStep
                    fileName={analysis.file.name}
                    metadata={analysis.metadata}
                    comparisonRows={comparisonRows}
                    currentVersionLabel={currentVersionLabel}
                    nextVersionLabel={nextVersionLabel}
                    requiresReview={requiresReview ?? false}
                    reviewChecked={reviewChecked}
                    onReviewCheckedChange={setReviewChecked}
                  />
                )
              ) : (
                <div className="flex min-h-full flex-col gap-3">
                  <div className="shrink-0 space-y-3">
                    <CurrentDocumentSummaryCard
                      document={detail.document}
                      currentVersionLabel={currentVersionLabel}
                      compact
                    />
                    <CurrentMetadataPanel fields={metadataFields} compact />
                    <VersionHistorySummary
                      currentVersionLabel={currentVersionLabel}
                      nextVersionLabel={nextVersionLabel}
                      versions={versions.map((version) => ({
                        ...version,
                        isCurrent:
                          version.isCurrent ??
                          (version.versionId === detail.latestVersion?.versionId ||
                            version.versionLabel === currentVersionLabel),
                      }))}
                      compact
                    />
                  </div>

                  {phase === 'analyzing' && selectedFile ? (
                    <NewVersionAnalyzingPanel
                      fileName={selectedFile.name}
                      fileSize={selectedFile.size}
                      currentVersionLabel={currentVersionLabel}
                      nextVersionLabel={nextVersionLabel}
                      fillHeight
                    />
                  ) : (
                    <NewVersionUploadDropzone
                      nextVersionLabel={nextVersionLabel}
                      disabled={!canUpdate}
                      selectedFile={selectedFile}
                      fillHeight
                      onFileSelected={handleFileSelected}
                      onClearFile={() => {
                        setSelectedFile(null);
                        setPhase('ready');
                      }}
                      onValidationError={(message) => toast.error(message)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-doqyn-border-subtle px-4 py-3">
          <ConfirmNewVersionActions
            phase={
              phase === 'ready'
                ? 'ready'
                : phase === 'analyzing'
                  ? 'analyzing'
                  : phase === 'review'
                    ? 'review'
                    : phase === 'confirming'
                      ? 'confirming'
                      : phase === 'success'
                        ? 'success'
                        : 'error'
            }
            nextVersionLabel={nextVersionLabel}
            canConfirm={canConfirm}
            onConfirm={() => void handleConfirm()}
            onClose={onClose}
            onRetry={resetFlow}
          />
        </div>
      </aside>
    </div>
  );
}
