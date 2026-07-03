import { useEffect, useRef, useState } from 'react';
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import { setupPdfWorker } from './pdfWorkerSetup';

setupPdfWorker();

type UsePdfDocumentResult = {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  loading: boolean;
  error: Error | null;
};

export function usePdfDocument(data: ArrayBuffer | null): UsePdfDocumentResult {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    if (!data) {
      setPdf(null);
      setNumPages(0);
      setLoading(false);
      setError(null);
      return;
    }

    const loadId = ++loadIdRef.current;
    let cancelled = false;
    let activeDoc: PDFDocumentProxy | null = null;

    setLoading(true);
    setError(null);
    setPdf(null);
    setNumPages(0);

    void getDocument({ data: data.slice(0) })
      .promise.then((loaded) => {
        if (cancelled || loadId !== loadIdRef.current) {
          void loaded.destroy();
          return;
        }
        activeDoc = loaded;
        setPdf(loaded);
        setNumPages(loaded.numPages);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled || loadId !== loadIdRef.current) return;
        setError(loadError instanceof Error ? loadError : new Error('Falha ao carregar PDF.'));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (activeDoc) void activeDoc.destroy();
    };
  }, [data]);

  return { pdf, numPages, loading, error };
}
