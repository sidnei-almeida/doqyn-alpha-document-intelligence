export type VisionOcrPageText = {
  pageNumber: number;
  text: string;
  confidence?: number;
};

export type VisionOcrResult = {
  text: string;
  pages: VisionOcrPageText[];
  pageCount: number;
  charCount: number;
  truncated: boolean;
  provider: 'google_vision';
  pagesProcessed: number;
  durationMs: number;
};

export type VisionOcrHealth = {
  enabled: boolean;
  configured: boolean;
  credentialsPath?: string;
  message?: string;
};
