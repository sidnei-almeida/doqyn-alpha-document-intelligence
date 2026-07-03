export type PreviewViewerType = 'pdf_pages' | 'image' | 'unsupported' | 'deep_zoom_image';

export type PreviewManifestPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canUpdate: boolean;
  canViewTracking: boolean;
};

export type PreviewManifestPage = {
  page: number;
  width: number;
  height: number;
  rotation: number;
  aspectRatio: number;
  previewUrl: string;
  thumbnailUrl: string;
};

export type PreviewManifestImageResolution = {
  label: string;
  width: number;
  url: string;
};

export type PreviewManifestImage = {
  width: number;
  height: number;
  aspectRatio: number;
  previewUrl: string;
  thumbnailUrl: string;
  resolutions: PreviewManifestImageResolution[];
};

export type DocumentPreviewManifest = {
  documentId: string;
  versionId: string;
  fileName: string;
  mimeType: string;
  viewerType: PreviewViewerType;
  pageCount: number;
  permissions: PreviewManifestPermissions;
  pages: PreviewManifestPage[];
  image: PreviewManifestImage | null;
  status: 'ready' | 'processing' | 'failed';
};
