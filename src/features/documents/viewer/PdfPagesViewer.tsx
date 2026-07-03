import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PreviewManifestPage } from '@/types/preview-manifest';
import { usePreviewAsset } from './usePreviewAsset';
import type { ViewerComponentProps } from './viewerRegistry';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.15;
const FULL_RENDER_PAGE_LIMIT = 20;

function ManifestPageImage({
  page,
  scale,
  previewUrl,
}: {
  page: PreviewManifestPage;
  scale: number;
  previewUrl: string;
}) {
  const { objectUrl, state } = usePreviewAsset(previewUrl, true);
  const width = Math.max(1, Math.round(page.width * scale));
  const height = Math.max(1, Math.round(page.height * scale));

  return (
    <div
      data-page-number={page.page}
      className="viewer-page mx-auto flex w-full justify-center scroll-mt-4"
      style={{ maxWidth: width }}
    >
      {state === 'loading' && (
        <div
          className="flex items-center justify-center bg-white shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          style={{ width, height: Math.min(height, 480) }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-doqyn-muted" />
        </div>
      )}
      {state === 'ready' && objectUrl && (
        <img
          src={objectUrl}
          alt={`Página ${page.page}`}
          width={width}
          height={height}
          className="block max-w-full bg-white shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          draggable={false}
        />
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
  const { objectUrl, state } = usePreviewAsset(page.thumbnailUrl, true);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-md border p-1 transition-colors',
        isActive
          ? 'border-doqyn-accent bg-doqyn-accent/10'
          : 'border-doqyn-border-subtle hover:border-doqyn-border',
      )}
    >
      <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-white">
        {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-doqyn-muted" />}
        {state === 'ready' && objectUrl && (
          <img
            src={objectUrl}
            alt={`Miniatura página ${page.page}`}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        )}
      </div>
      <span className="text-[10px] text-doqyn-muted">{page.page}</span>
    </button>
  );
}

export function PdfPagesViewer({
  manifest,
  className,
  onToolbarStateChange,
  onRegisterActions,
}: ViewerComponentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
  const [currentPage, setCurrentPage] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(false);

  const pages = manifest.pages;
  const numPages = manifest.pageCount || pages.length;
  const useLazyRender = numPages > FULL_RENDER_PAGE_LIMIT;
  const canShowThumbnails = numPages > 1;

  const pagesToRender = useMemo(() => {
    if (!pages.length) return [];
    if (!useLazyRender) return pages;
    return pages.filter(
      (page) => page.page >= currentPage - 1 && page.page <= currentPage + 1,
    );
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
        <p className="text-sm text-doqyn-muted">Preview em processamento...</p>
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className={cn('viewer-canvas flex h-full items-center justify-center px-6 text-center', className)}>
        <p className="text-sm text-doqyn-muted">Nenhuma página disponível para visualização.</p>
      </div>
    );
  }

  return (
    <div className={cn('viewer-canvas flex h-full min-h-0', className)}>
      {canShowThumbnails && showThumbnails && (
        <aside className="hidden w-28 shrink-0 overflow-y-auto border-r border-doqyn-border bg-doqyn-bg/90 p-2 sm:block">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowThumbnails((current) => !current)}
              title={showThumbnails ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
            >
              {showThumbnails ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        <div ref={scrollRef} className="h-full overflow-y-auto bg-[#0b0d10]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6">
            {useLazyRender && (
              <p className="rounded-md border border-doqyn-border bg-doqyn-bg/80 px-3 py-2 text-xs text-doqyn-muted">
                Este documento é grande. Algumas páginas serão carregadas sob demanda.
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
                <ManifestPageImage page={page} scale={scale} previewUrl={page.previewUrl} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
