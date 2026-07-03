import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDocumentPreviewBlob } from '../api/documentsApi.blobs';
import { normalizeMimeType } from './documentMime';

export type PreviewBlobState = 'idle' | 'loading' | 'ready' | 'error';

type UseDocumentPreviewBlobInput = {
  documentId: string;
  versionId: string;
  enabled?: boolean;
};

type UseDocumentPreviewBlobResult = {
  blob: Blob | null;
  arrayBuffer: ArrayBuffer | null;
  mimeType: string;
  state: PreviewBlobState;
  error: unknown;
  fallbackObjectUrl: string | null;
  retry: () => void;
};

export function useDocumentPreviewBlob({
  documentId,
  versionId,
  enabled = true,
}: UseDocumentPreviewBlobInput): UseDocumentPreviewBlobResult {
  const trackedKeyRef = useRef<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [mimeType, setMimeType] = useState('application/pdf');
  const [state, setState] = useState<PreviewBlobState>('idle');
  const [error, setError] = useState<unknown>(null);
  const [fallbackObjectUrl, setFallbackObjectUrl] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !documentId || !versionId) {
      setBlob(null);
      setArrayBuffer(null);
      setState('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    const loadKey = `${documentId}:${versionId}`;
    const shouldTrack = trackedKeyRef.current !== loadKey;

    async function load() {
      setState('loading');
      setError(null);
      setBlob(null);
      setArrayBuffer(null);

      try {
        const nextBlob = await fetchDocumentPreviewBlob({
          documentId,
          versionId,
          trackView: shouldTrack,
        });

        if (cancelled) return;

        const buffer = await nextBlob.arrayBuffer();
        if (cancelled) return;

        setBlob(nextBlob);
        setArrayBuffer(buffer);
        setMimeType(normalizeMimeType(nextBlob.type));
        setState('ready');
        if (shouldTrack) trackedKeyRef.current = loadKey;
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError);
        setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [documentId, versionId, enabled, reloadToken]);

  useEffect(() => {
    if (!blob) {
      setFallbackObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setFallbackObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return {
    blob,
    arrayBuffer,
    mimeType,
    state,
    error,
    fallbackObjectUrl,
    retry,
  };
}
