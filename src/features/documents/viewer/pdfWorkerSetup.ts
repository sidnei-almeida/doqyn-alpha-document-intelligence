import { GlobalWorkerOptions } from 'pdfjs-dist';

let workerConfigured = false;

/** Configura o worker do PDF.js uma única vez (compatível com Vite). */
export function setupPdfWorker(): void {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  workerConfigured = true;
}
