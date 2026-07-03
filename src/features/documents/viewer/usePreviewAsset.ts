import { useEffect, useState } from 'react';
import { fetchPreviewAssetBlob } from '../api/previewManifestApi';

type PreviewAssetState = 'idle' | 'loading' | 'ready' | 'error';

export function usePreviewAsset(url: string | null, enabled = true) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [state, setState] = useState<PreviewAssetState>('idle');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setObjectUrl(null);
      setState('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    let localUrl: string | null = null;

    async function load() {
      setState('loading');
      setError(null);

      try {
        const blob = await fetchPreviewAssetBlob(url!);
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
        setState('ready');
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError);
        setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [url, enabled]);

  useEffect(
    () => () => {
      setObjectUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    },
    [],
  );

  return { objectUrl, state, error };
}
