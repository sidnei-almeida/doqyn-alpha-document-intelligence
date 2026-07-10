import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import { ConfidenceBadge } from '@/features/document-send/components/ConfidenceBadge';
import { DocumentNamingSection } from '@/features/document-send/components/DocumentNamingSection';
import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import {
  policyRequiresPerItemChoice,
  resolveFinalFileNameForConfirm,
} from '@/features/document-send/utils/reviewWorkflowSettings';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useAuth } from '@/auth/useAuth';
import { canConfirmDocumentMetadata } from '@/lib/documentAdminAccess';
import { useUploadQueueContext } from '../uploadQueueContext';

/**
 * Revisão pós-análise RAG na fila da Biblioteca — respeita preferências de nomeação e confirmação.
 */
export function ReviewDrawer() {
  const {
    items,
    reviewItemId,
    reviewSettings,
    closeReview,
    confirmReview,
    setItemNamingChoice,
  } = useUploadQueueContext();
  const { hasAnyRole } = useAuth();
  const isDocumentAdmin = canConfirmDocumentMetadata(hasAnyRole);

  const [isConfirming, setIsConfirming] = useState(false);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [perItemNaming, setPerItemNaming] = useState<PerItemNamingChoice>({
    namingMode: 'ai_suggested',
  });

  const item = useMemo(
    () => items.find((entry) => entry.id === reviewItemId) ?? null,
    [items, reviewItemId],
  );

  const queuePosition = useMemo(() => {
    if (!item) return null;
    const pending = items.filter((entry) => entry.status === 'review' || entry.status === 'analyzing');
    const index = pending.findIndex((entry) => entry.id === item.id);
    return index >= 0 ? { current: index + 1, total: pending.length } : null;
  }, [items, item]);

  useEffect(() => {
    if (!item) return;
    setReviewChecked(false);
    setIsConfirming(false);
    setPerItemNaming(
      item.namingChoice ?? {
        namingMode:
          reviewSettings.defaultNamingPolicy === 'original'
            ? 'original'
            : reviewSettings.defaultNamingPolicy === 'manual_required'
              ? 'manual'
              : 'ai_suggested',
      },
    );
  }, [reviewItemId, item, reviewSettings.defaultNamingPolicy]);

  if (!item || !item.analysis) return null;

  const { metadata, raw } = item.analysis;
  const reasons = metadata.reviewReasons ?? [];
  const requiresReview = metadata.analysisStatus === 'requires_review';
  const uploadDestination = item.context?.categoryName;
  const aiClassId = raw.classification.classId;
  const aiClassName = raw.classification.className ?? metadata.documentType;
  const hasCategoryMismatch = Boolean(
    item.context?.categoryId && aiClassId && item.context.categoryId !== aiClassId,
  );
  const showNaming =
    reviewSettings.aiRenameEnabled &&
    (policyRequiresPerItemChoice(reviewSettings.defaultNamingPolicy) ||
      reviewSettings.defaultNamingPolicy === 'manual_required');

  const finalPreview = resolveFinalFileNameForConfirm({
    settings: reviewSettings,
    originalFileName: raw.originalFileName,
    aiSuggestedFileName: raw.recommendedFileName ?? raw.originalFileName,
    perItem: perItemNaming,
  });

  const canConfirm =
    reviewChecked &&
    finalPreview !== '—' &&
    (!reviewSettings.defaultNamingPolicy ||
      reviewSettings.defaultNamingPolicy !== 'manual_required' ||
      Boolean(perItemNaming.manualName?.trim()));

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      setItemNamingChoice(item.id, perItemNaming);
      await confirmReview(item.id, perItemNaming);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <WorkspaceSideDrawer
      title={requiresReview ? 'Revisão necessária' : isDocumentAdmin ? 'Confirmar análise' : 'Enviar para aprovação'}
      onClose={closeReview}
      testId="upload-review-drawer"
      zIndexClass="z-[95]"
      scrollable={false}
      bodyClassName="flex flex-col overflow-hidden p-0"
      header={
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-doqyn-border-subtle px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-primary">
              {requiresReview ? 'Revisão necessária' : isDocumentAdmin ? 'Confirmar análise' : 'Enviar para aprovação'}
            </p>
            <TruncatedText as="h2" className="mt-0.5 text-[14px] font-semibold text-doqyn-text">
              {item.fileName}
            </TruncatedText>
            {queuePosition && queuePosition.total > 1 && (
              <p className="mt-1 text-[11px] text-doqyn-muted">
                {queuePosition.current} de {queuePosition.total} aguardando revisão
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip label="Preferências de upload">
              <Link
                to="/settings?section=upload-ia"
                className="explorer-icon-btn shrink-0"
                aria-label="Preferências de upload"
                onClick={closeReview}
              >
                <Icon name="settings" size={ICON_SIZE.sm} />
              </Link>
            </Tooltip>
            <button
              type="button"
              onClick={closeReview}
              className="explorer-icon-btn shrink-0"
              aria-label="Fechar revisão"
              data-testid="upload-review-drawer-close"
            >
              <Icon name="close" size={ICON_SIZE.sm} />
            </button>
          </div>
        </header>
      }
    >
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {uploadDestination && (
            <div className="mb-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-card/40 px-3 py-2">
              <div className="flex items-start gap-2.5">
                <Icon
                  name="folder_open"
                  size={ICON_SIZE.sm}
                  className="mt-0.5 shrink-0 text-doqyn-accent"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-doqyn-text">
                    Pasta atual: {uploadDestination}
                  </p>
                  <p className="mt-0.5 text-[11px] text-doqyn-muted">
                    A IA classificou como: {aiClassName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasCategoryMismatch && (
            <div className="mb-3 flex gap-2 rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg px-3 py-2">
              <Icon
                name="warning"
                size={ICON_SIZE.sm}
                className="mt-0.5 shrink-0 text-doqyn-warning"
              />
              <p className="text-[12px] text-doqyn-warning">
                A IA sugeriu <strong>{aiClassName}</strong>, mas você está enviando para{' '}
                <strong>{uploadDestination}</strong>. A categoria final seguirá a análise da IA.
              </p>
            </div>
          )}

          {reasons.length > 0 && (
            <div className="mb-3 flex gap-2 rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg px-3 py-2">
              <Icon
                name="warning"
                size={ICON_SIZE.sm}
                className="mt-0.5 shrink-0 text-doqyn-warning"
              />
              <ul className="space-y-1 text-[12px] text-doqyn-warning">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {showNaming && (
            <DocumentNamingSection
              settings={reviewSettings}
              originalFileName={raw.originalFileName}
              aiSuggestedFileName={raw.recommendedFileName ?? raw.originalFileName}
              perItemChoice={perItemNaming}
              onPerItemChoiceChange={setPerItemNaming}
              className="mb-3"
            />
          )}

          <dl className="space-y-2">
            {!showNaming && (
              <ReviewField
                label="Nome final"
                value={finalPreview !== '—' ? finalPreview : metadata.suggestedName}
              />
            )}
            <ReviewField label="Tipo de documento" value={metadata.documentType} />
            {reviewSettings.aiClassificationEnabled && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-doqyn-subtle">
                  Confiança da classificação
                </dt>
                <dd className="mt-1">
                  <ConfidenceBadge score={metadata.confidenceScore} />
                </dd>
              </div>
            )}
            {reviewSettings.aiMetadataEnabled &&
              (metadata.extractedFields ?? []).slice(0, 8).map((field) => (
                <ReviewField key={field.key} label={field.label} value={field.value} />
              ))}
          </dl>
        </div>

        <footer className="shrink-0 border-t border-doqyn-border-subtle px-4 py-3">
          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-doqyn-muted">
            <input
              type="checkbox"
              checked={reviewChecked}
              onChange={(event) => setReviewChecked(event.target.checked)}
              className="mt-0.5"
            />
            Revisei os dados extraídos e confirmo o{' '}
            {isDocumentAdmin ? 'salvamento' : 'envio para aprovação'} deste documento.
          </label>
          {!isDocumentAdmin && (
            <p className="mt-2 text-[11px] text-doqyn-muted">
              Um administrador da empresa revisará os metadados na Auditoria antes de publicar na
              Biblioteca.
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={closeReview}>
              Deixar para depois
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canConfirm || isConfirming}
              onClick={() => void handleConfirm()}
            >
              {isConfirming && (
                <Icon name="progress_activity" size={ICON_SIZE.sm} className="animate-spin" />
              )}
              {isDocumentAdmin ? 'Confirmar e salvar' : 'Enviar para aprovação'}
            </Button>
          </div>
        </footer>
    </WorkspaceSideDrawer>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-[12px] text-doqyn-text">{value || '—'}</dd>
    </div>
  );
}
