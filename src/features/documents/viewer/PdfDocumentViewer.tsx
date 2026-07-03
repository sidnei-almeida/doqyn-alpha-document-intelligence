import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getPreviewErrorMessage } from '../utils/previewErrors';
import { PDF_FULL_RENDER_PAGE_LIMIT } from './documentViewerTypes';
import { PdfPageCanvas } from './PdfPageCanvas';
import { usePdfDocument } from './usePdfDocument';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.15;

export type PdfDocumentViewerProps = {
  arrayBuffer: ArrayBuffer | null;
  loading?: boolean;
  loadError?: unknown;
  fallbackObjectUrl?: string | null;
  onRetry?: () => void;
  onToolbarStateChange?: (state: {
    scale: number;
    currentPage: number;
    totalPages: number;
    isLoading: boolean;
    canZoomIn: boolean;
    canZoomOut: boolean;
  }) => void;
  onRegisterActions?: (actions: {
    zoomIn: () => void;
    zoomOut: () => void;
    fitWidth: () => void;
    fitPage: () => void;
    previousPage: () => void;
    nextPage: () => void;
  }) => void;
  className?: string;
};

export function PdfDocumentViewer({
  arrayBuffer,
  loading: externalLoading = false,
  loadError,
  fallbackObjectUrl,
  onRetry,
  onToolbarStateChange,
  onRegisterActions,
  className,
}: PdfDocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { pdf, numPages, loading: pdfLoading, error: pdfError } = usePdfDocument(arrayBuffer);

  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');
  const [currentPage, setCurrentPage] = useState(1);
  const [usePdfJsFallback, setUsePdfJsFallback] = useState(false);

  const isLoading = externalLoading || pdfLoading;
  const renderError = loadError ?? pdfError;
  const useLazyRender = numPages > PDF_FULL_RENDER_PAGE_LIMIT;
  const pagesToRender = useMemo(() => {
    if (!numPages) return [];
    if (useLazyRender) {
      const start = Math.max(1, currentPage - 1);
      const end = Math.min(numPages, currentPage + 1);
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return Array.from({ length: numPages }, (_, index) => index + 1);
  }, [numPages, useLazyRender, currentPage]);

  const applyFitWidth = useCallback(async () => {
    if (!pdf || !scrollRef.current) return;
    const page = await pdf.getPage(currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = scrollRef.current.clientWidth - 48;
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, containerWidth / viewport.width),
    );
    setScale(nextScale);
    setFitMode('width');
  }, [pdf, currentPage]);

  const applyFitPage = useCallback(async () => {
    if (!pdf || !scrollRef.current) return;
    const page = await pdf.getPage(currentPage);
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = scrollRef.current.clientWidth - 48;
    const containerHeight = scrollRef.current.clientHeight - 48;
    const widthScale = containerWidth / viewport.width;
    const heightScale = containerHeight / viewport.height;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(widthScale, heightScale)));
    setScale(nextScale);
    setFitMode('page');
  }, [pdf, currentPage]);

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
      fitWidth: () => void applyFitWidth(),
      fitPage: () => void applyFitPage(),
      previousPage,
      nextPage,
    });
  }, [
    onRegisterActions,
    zoomIn,
    zoomOut,
    applyFitWidth,
    applyFitPage,
    previousPage,
    nextPage,
  ]);

  useEffect(() => {
    if (!pdf || fitMode !== 'width') return;
    void applyFitWidth();
  }, [pdf, numPages, fitMode, applyFitWidth]);

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
      isLoading,
      canZoomIn: scale < MAX_SCALE,
      canZoomOut: scale > MIN_SCALE,
    });
  }, [scale, currentPage, numPages, isLoading, onToolbarStateChange]);

  useEffect(() => {
    if (pdfError) setUsePdfJsFallback(true);
  }, [pdfError]);

  if (isLoading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex items-center gap-2 text-sm text-doqyn-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando visualizador...
        </div>
      </div>
    );
  }

  if (renderError && !pdf) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-3 px-6 text-center', className)}>
        <p className="text-sm text-doqyn-danger">{getPreviewErrorMessage(renderError)}</p>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (usePdfJsFallback && fallbackObjectUrl) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-4 px-6 text-center', className)}>
        <p className="text-sm text-doqyn-muted">
          Não foi possível carregar o visualizador avançado. Abrindo preview básico.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => window.open(fallbackObjectUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir preview em nova aba
        </Button>
        {onRetry && (
          <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
            Tentar visualizador avançado
          </Button>
        )}
      </div>
    );
  }

  if (!pdf || numPages === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center px-6 text-center', className)}>
        <p className="text-sm text-doqyn-muted">Nenhuma página disponível para visualização.</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={cn('h-full overflow-y-auto bg-[#0b0d10]', className)}>
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-6 px-4 py-6">
        {useLazyRender && (
          <p className="rounded-md border border-doqyn-border bg-doqyn-bg/80 px-3 py-2 text-xs text-doqyn-muted">
            Documento com {numPages} páginas — renderização sob demanda ativa para melhor desempenho.
          </p>
        )}

        {pagesToRender.map((pageNumber) => (
          <div
            key={pageNumber}
            ref={(element) => {
              if (element) pageRefs.current.set(pageNumber, element);
              else pageRefs.current.delete(pageNumber);
            }}
            data-page-number={pageNumber}
            className="w-full scroll-mt-4"
          >
            <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} scale={scale} />
          </div>
        ))}
      </div>
      {/* TODO: text layer, search, copy e annotation layer */}
    </div>
  );
}
