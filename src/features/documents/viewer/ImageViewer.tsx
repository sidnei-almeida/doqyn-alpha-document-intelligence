import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { usePreviewAsset } from './usePreviewAsset';
import type { ViewerComponentProps } from './viewerRegistry';

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

export function ImageViewer({
  manifest,
  className,
  onToolbarStateChange,
  onRegisterActions,
}: ViewerComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<'width' | 'screen' | 'custom'>('screen');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const imageMeta = manifest.image;
  const previewUrl = useMemo(() => {
    if (!imageMeta) return null;
    const medium = imageMeta.resolutions.find((item) => item.label === 'medium');
    const large = imageMeta.resolutions.find((item) => item.label === 'large');
    const useLarge = scale > 1;
    if (useLarge && large?.url) return large.url;
    return medium?.url ?? imageMeta.previewUrl;
  }, [imageMeta, scale]);

  const { objectUrl, state } = usePreviewAsset(previewUrl, Boolean(imageMeta));

  const applyFitWidth = useCallback(() => {
    if (!containerRef.current || !imageMeta?.width) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, containerWidth / imageMeta.width)));
    setFitMode('width');
    setPan({ x: 0, y: 0 });
  }, [imageMeta]);

  const applyFitScreen = useCallback(() => {
    if (!containerRef.current || !imageMeta) return;
    const containerWidth = containerRef.current.clientWidth - 48;
    const containerHeight = containerRef.current.clientHeight - 48;
    const widthScale = containerWidth / imageMeta.width;
    const heightScale = containerHeight / imageMeta.height;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(widthScale, heightScale))));
    setFitMode('screen');
    setPan({ x: 0, y: 0 });
  }, [imageMeta]);

  const zoomIn = useCallback(() => {
    setFitMode('custom');
    setScale((current) => Math.min(MAX_SCALE, Number((current + SCALE_STEP).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    setFitMode('custom');
    setScale((current) => Math.max(MIN_SCALE, Number((current - SCALE_STEP).toFixed(2))));
  }, []);

  const resetZoom = useCallback(() => {
    applyFitScreen();
  }, [applyFitScreen]);

  useEffect(() => {
    onRegisterActions?.({
      zoomIn,
      zoomOut,
      fitWidth: applyFitWidth,
      fitPage: applyFitScreen,
      previousPage: () => undefined,
      nextPage: () => undefined,
      resetZoom,
    });
  }, [onRegisterActions, zoomIn, zoomOut, applyFitWidth, applyFitScreen, resetZoom]);

  useEffect(() => {
    if (fitMode === 'screen') applyFitScreen();
    if (fitMode === 'width') applyFitWidth();
  }, [fitMode, imageMeta, applyFitScreen, applyFitWidth]);

  useEffect(() => {
    onToolbarStateChange?.({
      scale,
      currentPage: 1,
      totalPages: 1,
      isLoading: state === 'loading',
      canZoomIn: scale < MAX_SCALE,
      canZoomOut: scale > MIN_SCALE,
    });
  }, [scale, state, onToolbarStateChange]);

  if (!imageMeta) {
    return (
      <div className={cn('viewer-image flex h-full items-center justify-center px-6 text-center', className)}>
        <p className="text-sm text-doqyn-muted">Metadados de imagem indisponíveis.</p>
      </div>
    );
  }

  const displayWidth = Math.round(imageMeta.width * scale);
  const displayHeight = Math.round(imageMeta.height * scale);

  return (
    <div
      ref={containerRef}
      className={cn('viewer-image viewer-canvas-stage relative h-full overflow-hidden', className)}
      onPointerDown={(event) => {
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: pan.x,
          originY: pan.y,
        };
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        setPan({
          x: dragRef.current.originX + (event.clientX - dragRef.current.startX),
          y: dragRef.current.originY + (event.clientY - dragRef.current.startY),
        });
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
      }}
    >
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded-md border border-doqyn-border bg-doqyn-bg/90 px-2 py-1 text-xs text-doqyn-muted">
          {imageMeta.width} × {imageMeta.height}px
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
          <Icon name="rotate_right" size={14} />
        </Button>
      </div>

      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        {state === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-doqyn-muted">
            <Icon name="progress_activity" size={ICON_SIZE.xs} className="animate-spin" />
            Carregando imagem...
          </div>
        )}
        {state === 'ready' && objectUrl && (
          <img
            src={objectUrl}
            alt={manifest.fileName}
            draggable={false}
            decoding="async"
            className="viewer-page-surface viewer-page-image max-w-none select-none"
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
