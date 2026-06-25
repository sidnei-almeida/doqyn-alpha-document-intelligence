import { useState } from 'react';
import { AlertTriangle, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ExtractedMetadata, ProcessingLogItem } from '../types';
import { formatFileSize } from '../utils/validateUpload';
import { metadataToFields } from '../utils/documentNaming';
import { ConfidenceBadge } from './ConfidenceBadge';
import { TimelineItem } from './TimelineItem';

const FULL_WIDTH_FIELDS = new Set([
  'Justificativa',
  'Campos ausentes',
  'Texto extraído',
  'Nome sugerido',
]);

interface UploadResultPanelProps {
  fileName: string;
  fileSize: number;
  metadata: ExtractedMetadata;
  logs: ProcessingLogItem[];
  flowPhase: 'completed' | 'saving' | 'error';
  onConfirm?: () => void;
  onReprocess?: () => void;
  onNextDocument?: () => void;
  canReprocess?: boolean;
  isConfirming?: boolean;
  canConfirm?: boolean;
  requiresManualReview?: boolean;
  manualReviewChecked?: boolean;
  onManualReviewCheckedChange?: (checked: boolean) => void;
  autoCountdown?: number | null;
  autoPaused?: boolean;
  autoMode?: boolean;
  onCancelAuto?: () => void;
  onManualReview?: () => void;
  className?: string;
}

export function UploadResultPanel({
  fileName,
  fileSize,
  metadata,
  logs,
  flowPhase,
  onConfirm,
  onReprocess,
  onNextDocument,
  canReprocess = true,
  isConfirming = false,
  canConfirm = false,
  requiresManualReview = false,
  manualReviewChecked = false,
  onManualReviewCheckedChange,
  autoCountdown = null,
  autoPaused = false,
  autoMode = false,
  onCancelAuto,
  onManualReview,
  className,
}: UploadResultPanelProps) {
  const [activeTab, setActiveTab] = useState<'resultado' | 'logs'>('resultado');
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const summaryFields = metadataToFields(metadata);
  const requiresReview = metadata.analysisStatus === 'requires_review';
  const aiUnavailable = metadata.analysisStatus === 'ai_unavailable';
  const isSaved = Boolean(metadata.savedDocumentId);
  const showConfirmActions =
    activeTab === 'resultado' && !isSaved && flowPhase !== 'error';
  const showAutoBanner =
    autoCountdown !== null && autoCountdown > 0 && !autoPaused && !isSaved;

  const toggleEvidence = (key: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card
      className={cn(
        'flow-enter flex h-full min-h-0 w-full flex-col overflow-hidden border-doqyn-border bg-doqyn-surface',
        className,
      )}
    >
      <CardHeader className="shrink-0 space-y-3 border-b border-doqyn-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>Metadados extraídos</CardTitle>
            <p className="mt-1 text-xs text-doqyn-muted">
              {flowPhase === 'error'
                ? 'Não foi possível concluir a análise'
                : isSaved
                  ? 'Análise concluída e documento salvo'
                  : 'Análise concluída — revise os metadados antes de confirmar'}
            </p>
          </div>
          <ConfidenceBadge score={metadata.confidenceScore} />
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30 px-3 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-doqyn-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-doqyn-text" title={fileName}>
              {fileName}
            </p>
            <p className="text-xs text-doqyn-muted">{formatFileSize(fileSize)}</p>
          </div>
        </div>

        {autoMode && autoPaused && requiresReview && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-doqyn-text">
            Auto pausado: revisão necessária.
          </div>
        )}

        {showAutoBanner && (
          <div className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-4 py-3">
            <p className="text-xs font-medium text-doqyn-text">Análise concluída</p>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              Salvando automaticamente em {autoCountdown}s
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelAuto}
                className="h-7 px-2 text-xs text-doqyn-muted"
              >
                Cancelar auto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onManualReview}
                className="h-7 px-2 text-xs text-doqyn-muted"
              >
                Revisar manualmente
              </Button>
            </div>
          </div>
        )}

        <div className="flex w-full gap-1 border-b border-doqyn-border">
          <button
            type="button"
            onClick={() => setActiveTab('resultado')}
            className={cn(
              'flex-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:flex-none',
              activeTab === 'resultado'
                ? 'border-doqyn-primary text-doqyn-text'
                : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            Resultado
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'flex-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:flex-none',
              activeTab === 'logs'
                ? 'border-doqyn-primary text-doqyn-text'
                : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            Logs
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {activeTab === 'logs' ? (
          <ol
            className="min-h-0 flex-1 space-y-0 overflow-y-auto px-6 py-4 scrollbar-thin"
            aria-label="Logs de processamento"
          >
            {logs.map((log, index) => (
              <TimelineItem key={log.id} log={log} isLast={index === logs.length - 1} />
            ))}
          </ol>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4 scrollbar-thin">
              {aiUnavailable && (
                <div className="shrink-0 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-doqyn-text">Análise automática indisponível</p>
                      <p className="text-doqyn-muted">
                        {metadata.classificationReason ||
                          'Limite temporário da análise automática atingido. Aguarde alguns minutos e tente novamente.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {requiresReview && (
                <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-doqyn-text">Revisão necessária</p>
                      <p className="text-doqyn-muted">
                        Alguns campos precisam ser validados antes do salvamento.
                      </p>
                      {metadata.classificationReason && (
                        <p className="line-clamp-3 text-doqyn-muted">
                          {metadata.classificationReason}
                        </p>
                      )}
                      {metadata.missingFields && metadata.missingFields.length > 0 && (
                        <p className="text-doqyn-muted">
                          Campos ausentes: {metadata.missingFields.join(', ')}
                        </p>
                      )}
                      {metadata.reviewReasons && metadata.reviewReasons.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 text-doqyn-muted">
                          {metadata.reviewReasons.map((reason) => (
                            <li key={reason} className="line-clamp-2">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {flowPhase === 'error' && (
                <div className="rounded-lg border border-doqyn-danger-border bg-doqyn-danger-bg px-4 py-3 text-xs text-doqyn-danger">
                  {logs.find((l) => l.status === 'error')?.description ??
                    'Ocorreu um erro durante a análise. Tente enviar o documento novamente.'}
                </div>
              )}

              {flowPhase !== 'error' && (
                <>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-3">
                    {summaryFields.map((field) => (
                      <div
                        key={field.label}
                        className={cn(
                          'flex items-start justify-between gap-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-4 py-2.5',
                          FULL_WIDTH_FIELDS.has(field.label) && 'lg:col-span-2',
                        )}
                      >
                        <span className="shrink-0 text-xs text-doqyn-muted">{field.label}</span>
                        <span
                          className={cn(
                            'min-w-0 text-right text-sm font-medium text-doqyn-text',
                            field.label === 'Nome sugerido' && 'font-mono text-xs',
                            FULL_WIDTH_FIELDS.has(field.label) && 'text-left',
                          )}
                          title={field.value}
                        >
                          <span
                            className={cn(
                              'block break-words',
                              !FULL_WIDTH_FIELDS.has(field.label) && 'line-clamp-2',
                              field.label === 'Justificativa' && 'line-clamp-4',
                            )}
                          >
                            {field.value}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {metadata.classificationEvidence &&
                    metadata.classificationEvidence.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-doqyn-text">
                          Evidências da classificação
                        </p>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {metadata.classificationEvidence.map((item, index) => (
                            <div
                              key={`${item.snippet}-${index}`}
                              className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/50 px-4 py-3"
                            >
                              <p className="text-xs leading-relaxed text-doqyn-muted">
                                {item.pageNumber ? (
                                  <span className="font-medium text-doqyn-text">
                                    Página {item.pageNumber}
                                  </span>
                                ) : (
                                  <span className="font-medium text-doqyn-text">Trecho</span>
                                )}
                                <span className="mt-1 block line-clamp-4">
                                  &ldquo;{item.snippet}&rdquo;
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {metadata.extractedFields && metadata.extractedFields.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-doqyn-text">Metadados por campo</p>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {metadata.extractedFields.map((field) => {
                          const evidenceKey = field.key;
                          const isExpanded = expandedEvidence[evidenceKey];
                          const evidenceText = field.evidence?.snippet ?? '';

                          return (
                            <div
                              key={field.key}
                              className="flex flex-col rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-medium text-doqyn-text">{field.label}</p>
                                {field.confidence !== undefined && (
                                  <span className="shrink-0 rounded-md border border-doqyn-border bg-doqyn-surface px-1.5 py-0.5 text-[10px] text-doqyn-muted">
                                    {Math.round(field.confidence * 100)}%
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 break-words text-sm text-doqyn-text">
                                {field.value}
                              </p>
                              {field.evidence && (
                                <div className="mt-3 rounded-md border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2">
                                  <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
                                    Evidência
                                    {field.evidence.pageNumber
                                      ? ` · pág. ${field.evidence.pageNumber}`
                                      : ''}
                                  </p>
                                  <p
                                    className={cn(
                                      'mt-1 text-xs leading-relaxed text-doqyn-muted',
                                      !isExpanded && 'line-clamp-3',
                                    )}
                                  >
                                    &ldquo;{evidenceText}&rdquo;
                                  </p>
                                  {evidenceText.length > 120 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleEvidence(evidenceKey)}
                                      className="mt-1 text-[10px] text-doqyn-primary hover:underline"
                                    >
                                      {isExpanded ? 'Ver menos' : 'Ver mais'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isSaved && (
                    <div className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-doqyn-text">
                      <p className="font-medium">Documento salvo</p>
                      <p className="mt-1 text-doqyn-muted">
                        {requiresManualReview
                          ? 'Metadados confirmados após revisão manual.'
                          : 'Metadados confirmados e persistidos com sucesso.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-doqyn-border-subtle bg-doqyn-surface px-6 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.18)]">
              {showConfirmActions && requiresReview && (
                <label className="mb-3 flex items-start gap-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/30 px-3 py-2.5 text-xs text-doqyn-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={manualReviewChecked}
                    onChange={(event) =>
                      onManualReviewCheckedChange?.(event.target.checked)
                    }
                  />
                  <span>Revisei os campos e confirmo o salvamento manual.</span>
                </label>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex shrink-0">
                  {onReprocess && flowPhase !== 'saving' && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-doqyn-border bg-transparent hover:bg-doqyn-hover"
                      onClick={onReprocess}
                      disabled={isConfirming || !canReprocess}
                      title={
                        !canReprocess
                          ? 'Reprocessar disponível apenas para o documento atual da sessão'
                          : undefined
                      }
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reprocessar análise
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {showConfirmActions && !isSaved && (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canConfirm || isConfirming || flowPhase === 'saving'}
                      onClick={onConfirm}
                    >
                      {isConfirming || flowPhase === 'saving'
                        ? 'Salvando...'
                        : requiresReview
                          ? 'Confirmar após revisão'
                          : 'Confirmar metadados'}
                    </Button>
                  )}
                  {onNextDocument && (
                    <Button
                      type="button"
                      variant={isSaved ? 'primary' : 'secondary'}
                      className={cn(
                        !isSaved && 'border-doqyn-border bg-transparent hover:bg-doqyn-hover',
                      )}
                      onClick={onNextDocument}
                      disabled={isConfirming || flowPhase === 'saving'}
                    >
                      Próximo documento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
