import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ConfidenceBadge } from '@/features/document-send/components/ConfidenceBadge';
import { DocumentNamingSection } from '@/features/document-send/components/DocumentNamingSection';
import type { PerItemNamingChoice } from '@/features/document-send/types/reviewWorkflowSettings';
import {
  policyRequiresPerItemChoice,
  resolveFinalFileNameForConfirm,
} from '@/features/document-send/utils/reviewWorkflowSettings';
import { ICON_SIZE } from '@/lib/iconDefaults';
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

  useEffect(() => {
    if (!reviewItemId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewItemId, closeReview]);

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
    <div
      className="fixed inset-0 z-[95] flex justify-end modal-overlay-scrim backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Revisão do documento"
      onClick={closeReview}
    >
      <aside
        className="drawer-enter-right flex h-full w-full max-w-lg flex-col border-l border-doqyn-border-subtle bg-doqyn-surface shadow-dropdown"
        onClick={(event) => event.stopPropagation()}
        data-testid="upload-review-drawer"
      >
        <header className="flex items-start justify-between gap-3 border-b border-doqyn-border-subtle px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow-text">
              {requiresReview ? 'Revisão necessária' : 'Confirmar análise da IA'}
            </p>
            <TruncatedText as="h2" className="mt-1 text-[16px] font-semibold text-doqyn-text">
              {item.fileName}
            </TruncatedText>
            {queuePosition && queuePosition.total > 1 && (
              <p className="mt-1 text-[11px] text-doqyn-muted">
                {queuePosition.current} de {queuePosition.total} aguardando revisão
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip label="Preferências de upload">
              <Link
                to="/settings?section=upload-ia"
                className="rounded-md p-1.5 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
                aria-label="Preferências de upload"
                onClick={closeReview}
              >
                <Icon name="settings" size={ICON_SIZE.sm} />
              </Link>
            </Tooltip>
            <button
              type="button"
              onClick={closeReview}
              className="rounded-md p-1.5 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
              aria-label="Fechar revisão"
            >
              <Icon name="close" size={ICON_SIZE.sm} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {uploadDestination && (
            <div className="mb-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-card/40 px-3 py-2.5">
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
            <div className="mb-4 flex gap-2.5 rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg px-3 py-2.5">
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
            <div className="mb-4 flex gap-2.5 rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg px-3 py-2.5">
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
              className="mb-4"
            />
          )}

          <dl className="space-y-3">
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

        <footer className="border-t border-doqyn-border px-5 py-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] text-doqyn-muted">
            <input
              type="checkbox"
              checked={reviewChecked}
              onChange={(event) => setReviewChecked(event.target.checked)}
              className="mt-0.5"
            />
            Revisei os dados extraídos e confirmo o salvamento deste documento.
          </label>
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
              Confirmar e salvar
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-doqyn-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-doqyn-text">{value || '—'}</dd>
    </div>
  );
}
