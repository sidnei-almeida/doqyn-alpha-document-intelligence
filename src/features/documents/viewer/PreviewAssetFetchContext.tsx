import { createContext, useContext, type ReactNode } from 'react';
import { fetchPreviewAssetBlob } from '../api/previewManifestApi';

export type PreviewAssetFetcher = (url: string) => Promise<Blob>;

const PreviewAssetFetchContext = createContext<PreviewAssetFetcher>(fetchPreviewAssetBlob);

export function PreviewAssetFetchProvider({
  fetchAsset,
  children,
}: {
  fetchAsset: PreviewAssetFetcher;
  children: ReactNode;
}) {
  return (
    <PreviewAssetFetchContext.Provider value={fetchAsset}>{children}</PreviewAssetFetchContext.Provider>
  );
}

export function usePreviewAssetFetch(): PreviewAssetFetcher {
  return useContext(PreviewAssetFetchContext);
}
