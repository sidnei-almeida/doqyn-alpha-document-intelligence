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
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';
import { canConfirmDocumentMetadata } from '@/lib/documentAdminAccess';
import { useUploadQueueContext } from '../uploadQueueContext';
import { CategoryQuickPicker } from './CategoryQuickPicker';
import { QuickFieldsEditor } from './QuickFieldsEditor';

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
  const [manualCategory, setManualCategory] = useState<{ id: string; name: string } | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string>>({});

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
    setManualCategory(null);
    setShowCategoryPicker(false);
    setFieldOverrides({});
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

  // Sem classe da IA, o documento só sai daqui com alguém escolhendo a categoria. Antes ele ficava
  // preso: a confirmação exige classe e a análise não tinha nenhuma para dar.
  const needsManualCategory = !aiClassId && !manualCategory;

  const canConfirm =
    reviewChecked &&
    !needsManualCategory &&
    finalPreview !== '—' &&
    (!reviewSettings.defaultNamingPolicy ||
      reviewSettings.defaultNamingPolicy !== 'manual_required' ||
      Boolean(perItemNaming.manualName?.trim()));

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      setItemNamingChoice(item.id, perItemNaming);
      await confirmReview(item.id, perItemNaming, manualCategory?.id, fieldOverrides);
    } finally {
      setIsConfirming(false);
    }
  };

  const handlePickCategory = (classId: string, className: string) => {
    setManualCategory({ id: classId, name: className });
    setShowCategoryPicker(false);
    // Trocar de categoria troca a lista de campos; o que foi digitado para a categoria anterior
    // não vale para a nova e seria pior manter na tela.
    setFieldOverrides({});
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldOverrides((current) => ({ ...current, [key]: value }));
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
            <p className="text-eyebrow uppercase text-doqyn-primary">
              {requiresReview ? 'Revisão necessária' : isDocumentAdmin ? 'Confirmar análise' : 'Enviar para aprovação'}
            </p>
            <TruncatedText as="h2" className="mt-0.5 text-body font-semibold text-doqyn-text">
              {item.fileName}
            </TruncatedText>
            {queuePosition && queuePosition.total > 1 && (
              <p className="mt-1 text-micro text-doqyn-muted">
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
          {/* Primeiro bloco da tela de propósito: sem categoria não há o que confirmar, e quem
              revisa um lote precisa resolver isso num clique, não caçando o campo. */}
          <div
            className={cn(
              'mb-3 rounded-lg border px-3 py-2.5',
              needsManualCategory
                ? 'border-doqyn-warning-border bg-doqyn-warning-bg'
                : 'border-doqyn-border-subtle bg-doqyn-card/40',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-eyebrow uppercase text-doqyn-muted">
                  Categoria
                </p>
                <p className="mt-0.5 text-body font-medium text-doqyn-text">
                  {manualCategory?.name ??
                    (aiClassId ? aiClassName : 'A IA não conseguiu classificar')}
                </p>
                <p className="mt-0.5 text-micro text-doqyn-muted">
                  {manualCategory
                    ? 'Escolhida por você. A IA fica registrada na auditoria.'
                    : aiClassId
                      ? 'Sugerida pela análise automática.'
                      : 'Escolha a categoria para salvar este documento.'}
                </p>
              </div>

              {!needsManualCategory && (
                <button
                  type="button"
                  onClick={() => setShowCategoryPicker((current) => !current)}
                  className="shrink-0 rounded-md px-2 py-1 text-caption font-medium text-doqyn-info hover:bg-doqyn-surface-hover"
                >
                  {showCategoryPicker ? 'Fechar' : 'Trocar'}
                </button>
              )}
            </div>

            {(needsManualCategory || showCategoryPicker) && (
              <div className="mt-2.5">
                <CategoryQuickPicker
                  selectedClassId={manualCategory?.id}
                  suggestedClassId={aiClassId}
                  onSelect={handlePickCategory}
                />
              </div>
            )}
          </div>

          {uploadDestination && (
            <div className="mb-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-card/40 px-3 py-2">
              <div className="flex items-start gap-2.5">
                <Icon
                  name="folder_open"
                  size={ICON_SIZE.sm}
                  className="mt-0.5 shrink-0 text-doqyn-accent"
                />
                <div className="min-w-0">
                  <p className="text-caption font-medium text-doqyn-text">
                    Pasta atual: {uploadDestination}
                  </p>
                  <p className="mt-0.5 text-micro text-doqyn-muted">
                    A IA classificou como: {aiClassName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conferir e corrigir antes de salvar: consertar uma data errada não pode exigir salvar
              o documento primeiro e abrir a ficha depois. */}
          <div className="mb-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-card/40 px-3 py-2.5">
            <QuickFieldsEditor
              categoryId={manualCategory?.id ?? aiClassId ?? null}
              metadata={metadata}
              overrides={fieldOverrides}
              onChange={handleFieldChange}
            />
          </div>

          {hasCategoryMismatch && (
            <div className="mb-3 flex gap-2 rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg px-3 py-2">
              <Icon
                name="warning"
                size={ICON_SIZE.sm}
                className="mt-0.5 shrink-0 text-doqyn-warning"
              />
              <p className="text-caption text-doqyn-warning">
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
              <ul className="space-y-1 text-caption text-doqyn-warning">
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
                <dt className="text-eyebrow uppercase text-doqyn-subtle">
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
          <label className="flex cursor-pointer items-start gap-2 text-micro text-doqyn-muted">
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
            <p className="mt-2 text-micro text-doqyn-muted">
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
      <dt className="text-eyebrow uppercase text-doqyn-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-caption text-doqyn-text">{value || '—'}</dd>
    </div>
  );
}
