import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';
import { emitClientTrackingEvent } from '@/features/tracking/api/trackingClientEvents';
import type { PreviewManifestPage } from '@/types/preview-manifest';
import { usePreviewAsset } from './usePreviewAsset';
import type { ViewerComponentProps } from './viewerRegistry';
import { EmptyHint } from '@/components/ui/EmptyHint';
import { useTranslation } from 'react-i18next';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.15;
const FULL_RENDER_PAGE_LIMIT = 20;

function ManifestPageImage({
  page,
  scale,
  previewUrl,
  onLoadError,
}: {
  page: PreviewManifestPage;
  scale: number;
  previewUrl: string;
  onLoadError?: (pageNumber: number) => void;
}) {
  const { t } = useTranslation('documents');

  const { objectUrl, state } = usePreviewAsset(previewUrl, true);
  const displayWidth = Math.max(1, Math.round(page.width * scale));

  useEffect(() => {
    if (state === 'error') onLoadError?.(page.page);
  }, [state, page.page, onLoadError]);

  return (
    <div
      data-page-number={page.page}
      className="viewer-page mx-auto flex w-full scroll-mt-4 justify-center"
      style={{ maxWidth: displayWidth }}
    >
      {state === 'loading' && (
        <div
          className="viewer-page-surface flex items-center justify-center"
          style={{ width: displayWidth, height: Math.min(Math.round(page.height * scale), 480) }}
        >
          <Icon
            name="progress_activity"
            size={ICON_SIZE.md}
            className="animate-spin text-doqyn-muted"
          />
        </div>
      )}
      {state === 'ready' && objectUrl && (
        <img
          src={objectUrl}
          alt={t('pdfPagesViewer.pageAlt', { page: page.page })}
          width={displayWidth}
          className="viewer-page-surface viewer-page-image block h-auto max-w-full"
          decoding="async"
          draggable={false}
        />
      )}
      {/* Sem este ramo, uma página que falha ao carregar não desenhava nada e o
          visualizador ficava um retângulo vazio — enquanto o cabeçalho seguia
          anunciando "Preview disponível", porque o manifesto tinha vindo certo.
          Um estado que existe precisa ter nome na tela. */}
      {state === 'error' && (
        <div
          className="viewer-page-surface flex flex-col items-center justify-center gap-2 px-6 text-center"
          style={{ width: displayWidth, height: Math.min(Math.round(page.height * scale), 480) }}
        >
          <Icon name="broken_image" size={ICON_SIZE.md} className="text-doqyn-subtle" />
          <p className="text-caption text-doqyn-muted">
            {t('pdfPagesViewer.naoFoiPossivelCarregar')} {page.page}.
          </p>
        </div>
      )}
    </div>
  );
}

function ThumbnailButton({
  page,
  isActive,
  onSelect,
}: {
  page: PreviewManifestPage;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('documents');
  const { objectUrl, state } = usePreviewAsset(page.thumbnailUrl, true);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        // A escolhida marca com régua de acento à esquerda, como toda lista do
        // sistema — a moldura inteira tingida era a única do app a fazer isso.
        'relative flex w-full flex-col items-center gap-1 rounded-[4px] p-1 transition-colors',
        'before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:bg-transparent',
        isActive
          ? 'bg-doqyn-surface-hover/60 before:bg-doqyn-accent-active'
          : 'hover:bg-doqyn-surface-hover/40',
      )}
    >
      <div className="viewer-page-surface flex h-20 w-full items-center justify-center overflow-hidden">
        {state === 'loading' && (
          <Icon
            name="progress_activity"
            size={ICON_SIZE.xs}
            className="animate-spin text-doqyn-muted"
          />
        )}
        {state === 'ready' && objectUrl && (
          <img
            src={objectUrl}
            alt={t('pdfPagesViewer.thumbAlt', { page: page.page })}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        )}
      </div>
      <span
        className={cn(
          'font-mono text-micro tabular-nums',
          isActive ? 'text-doqyn-text' : 'text-doqyn-subtle',
        )}
      >
        {page.page}
      </span>
    </button>
  );
}

export function PdfPagesViewer({
  manifest,
  className,
  onToolbarStateChange,
  onRegisterActions,
}: ViewerComponentProps) {
  const { t } = useTranslation('documents');

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
  const [currentPage, setCurrentPage] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(false);
  // Uma página que não carrega costuma vir acompanhada de outras vinte: a
  // trilha registra a falha do documento, não uma linha por imagem.
  const reportedFailureRef = useRef<string | null>(null);

  const handlePageLoadError = useCallback(
    (pageNumber: number) => {
      const key = `${manifest.documentId}:${manifest.versionId}`;
      if (reportedFailureRef.current === key) return;
      reportedFailureRef.current = key;

      emitClientTrackingEvent({
        action: 'document.preview_failed',
        documentId: manifest.documentId,
        versionId: manifest.versionId,
        metadata: {
          source: 'viewer_page_render',
          reason: 'preview_page_asset_load_failed',
          page: pageNumber,
        },
      });
    },
    [manifest.documentId, manifest.versionId],
  );

  const pages = manifest.pages;
  const numPages = manifest.pageCount || pages.length;
  const useLazyRender = numPages > FULL_RENDER_PAGE_LIMIT;
  const canShowThumbnails = numPages > 1;

  const pagesToRender = useMemo(() => {
    if (!pages.length) return [];
    if (!useLazyRender) return pages;
    return pages.filter((page) => page.page >= currentPage - 1 && page.page <= currentPage + 1);
  }, [pages, useLazyRender, currentPage]);

  const activePageMeta = pages.find((page) => page.page === currentPage) ?? pages[0] ?? null;

  const applyFitWidth = useCallback(() => {
    if (!scrollRef.current || !activePageMeta) return;
    const containerWidth = scrollRef.current.clientWidth - 48;
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, containerWidth / activePageMeta.width),
    );
    setScale(nextScale);
    setFitMode('width');
  }, [activePageMeta]);

  const applyFitPage = useCallback(() => {
    if (!scrollRef.current || !activePageMeta) return;
    const containerWidth = scrollRef.current.clientWidth - 48;
    const containerHeight = scrollRef.current.clientHeight - 48;
    const widthScale = containerWidth / activePageMeta.width;
    const heightScale = containerHeight / activePageMeta.height;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(widthScale, heightScale)));
    setScale(nextScale);
    setFitMode('page');
  }, [activePageMeta]);

  const scrollToPage = useCallback((pageNumber: number) => {
    const target = pageRefs.current.get(pageNumber);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrentPage(pageNumber);
  }, []);

  const zoomIn = useCallback(() => {
    setFitMode('custom');
    setScale((current) => Math.min(MAX_SCALE, Number((current + SCALE_STEP).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    setFitMode('custom');
    setScale((current) => Math.max(MIN_SCALE, Number((current - SCALE_STEP).toFixed(2))));
  }, []);

  const previousPage = useCallback(() => {
    scrollToPage(Math.max(1, currentPage - 1));
  }, [currentPage, scrollToPage]);

  const nextPage = useCallback(() => {
    scrollToPage(Math.min(numPages, currentPage + 1));
  }, [currentPage, numPages, scrollToPage]);

  useEffect(() => {
    onRegisterActions?.({
      zoomIn,
      zoomOut,
      fitWidth: applyFitWidth,
      fitPage: applyFitPage,
      previousPage,
      nextPage,
    });
  }, [onRegisterActions, zoomIn, zoomOut, applyFitWidth, applyFitPage, previousPage, nextPage]);

  useEffect(() => {
    if (fitMode !== 'width') return;
    applyFitWidth();
  }, [fitMode, activePageMeta, applyFitWidth]);

  useEffect(() => {
    if (!scrollRef.current || !numPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const pageNumber = Number(visible.target.getAttribute('data-page-number'));
        if (pageNumber) setCurrentPage(pageNumber);
      },
      { root: scrollRef.current, threshold: [0.35, 0.55, 0.75] },
    );

    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [numPages, pagesToRender, scale]);

  useEffect(() => {
    onToolbarStateChange?.({
      scale,
      currentPage,
      totalPages: numPages,
      isLoading: manifest.status !== 'ready',
      canZoomIn: scale < MAX_SCALE,
      canZoomOut: scale > MIN_SCALE,
    });
  }, [scale, currentPage, numPages, manifest.status, onToolbarStateChange]);

  if (manifest.status === 'processing') {
    return (
      <div className={cn('viewer-canvas flex h-full items-center justify-center', className)}>
        <p className="text-caption text-doqyn-muted">
          {t('pdfPagesViewer.previewEmProcessamento')}
        </p>
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div
        className={cn(
          'viewer-canvas flex h-full items-center justify-center px-6 text-center',
          className,
        )}
      >
        <EmptyHint bare>{t('pdfPagesViewer.nenhumaPaginaDisponivelPara')}</EmptyHint>
      </div>
    );
  }

  return (
    <div className={cn('viewer-canvas flex h-full min-h-0', className)}>
      {canShowThumbnails && showThumbnails && (
        <aside className="scrollbar-thin hidden w-28 shrink-0 overflow-y-auto border-r border-doqyn-border-subtle bg-doqyn-bg/90 p-2 sm:block">
          <div className="space-y-2">
            {pages.map((page) => (
              <ThumbnailButton
                key={page.page}
                page={page}
                isActive={page.page === currentPage}
                onSelect={() => scrollToPage(page.page)}
              />
            ))}
          </div>
        </aside>
      )}

      <div className="relative min-h-0 min-w-0 flex-1">
        {canShowThumbnails && (
          <div className="absolute left-3 top-3 z-10 hidden sm:block">
            <IconButton
              label={
                showThumbnails
                  ? t('pdfPagesViewer.hideThumbnails')
                  : t('pdfPagesViewer.showThumbnails')
              }
              onClick={() => setShowThumbnails((current) => !current)}
              className="bg-doqyn-bg/80"
            >
              <Icon
                name={showThumbnails ? 'left_panel_close' : 'left_panel_open'}
                size={ICON_SIZE.sm}
              />
            </IconButton>
          </div>
        )}

        <div ref={scrollRef} className="viewer-canvas-stage scrollbar-thin h-full overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6">
            {useLazyRender && (
              <p className="notice-rule py-0.5 text-caption text-doqyn-muted">
                {t('pdfPagesViewer.esteDocumentoEGrande')}
              </p>
            )}

            {pagesToRender.map((page) => (
              <div
                key={page.page}
                ref={(element) => {
                  if (element) pageRefs.current.set(page.page, element);
                  else pageRefs.current.delete(page.page);
                }}
                data-page-number={page.page}
              >
                <ManifestPageImage
                  page={page}
                  scale={scale}
                  previewUrl={page.previewUrl}
                  onLoadError={handlePageLoadError}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
