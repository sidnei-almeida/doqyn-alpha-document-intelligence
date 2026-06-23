import { useCallback, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { UploadCard, type UploadCardHandle } from './components/UploadCard';
import { UploadHistoryTable } from './components/UploadHistoryTable';
import { UploadQueue } from './components/UploadQueue';
import { UploadResultPanel } from './components/UploadResultPanel';
import {
  MOCK_UPLOAD_HISTORY,
  createBulkProcessingLogs,
  createSingleProcessingLogs,
  generateDocumentId,
} from './mockData';
import { processDocumentWithAI } from './services/processDocumentWithAI';
import type {
  DocumentHistoryItem,
  ExtractedMetadata,
  HistoryStatus,
  ProcessingLogItem,
  ProcessingStatus,
  UploadMode,
  UploadedDocument,
} from './types';
import { getConfidenceLevel } from './utils/documentNaming';

type UploadPhase = 'idle' | 'processing' | 'complete';

function formatNow(): string {
  const now = new Date();
  return `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function resolveStatuses(metadata: ExtractedMetadata): {
  queueStatus: ProcessingStatus;
  historyStatus: HistoryStatus;
} {
  const level = getConfidenceLevel(metadata.confidenceScore);

  if (level === 'low') {
    return { queueStatus: 'requires_review', historyStatus: 'requires_review' };
  }

  if (level === 'review') {
    return { queueStatus: 'requires_review', historyStatus: 'requires_review' };
  }

  return { queueStatus: 'name_generated', historyStatus: 'metadata_confirmed' };
}

function toHistoryItem(
  doc: UploadedDocument,
  metadata: ExtractedMetadata,
  historyStatus: HistoryStatus,
): DocumentHistoryItem {
  return {
    id: doc.id,
    originalName: doc.originalName,
    suggestedName: metadata.suggestedName,
    category: metadata.documentType,
    status: historyStatus,
    confidenceScore: metadata.confidenceScore,
    version: metadata.suggestedVersion,
    uploadedAt: doc.uploadedAt,
    lastActionAt: formatNow(),
  };
}

export function DocumentSendPage() {
  const uploadCardRef = useRef<UploadCardHandle>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [uploadMode, setUploadMode] = useState<UploadMode>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [queue, setQueue] = useState<UploadedDocument[]>([]);
  const [activeMetadata, setActiveMetadata] = useState<ExtractedMetadata | null>(null);
  const [metadataVisible, setMetadataVisible] = useState(false);
  const [logs, setLogs] = useState<ProcessingLogItem[]>(createSingleProcessingLogs());
  const [history, setHistory] = useState<DocumentHistoryItem[]>(MOCK_UPLOAD_HISTORY);
  const [lastProcessedFiles, setLastProcessedFiles] = useState<File[]>([]);
  const animationRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAnimations = useCallback(() => {
    animationRef.current.forEach(clearTimeout);
    animationRef.current = [];
  }, []);

  const animateLogs = useCallback((pending: ProcessingLogItem[], onComplete: () => void) => {
    setLogs(pending.map((log, i) => (i === 0 ? { ...log, status: 'active' as const } : log)));

    pending.forEach((_, index) => {
      const timeout = setTimeout(() => {
        setLogs((prev) =>
          prev.map((log, i) => {
            if (i <= index) {
              return {
                ...log,
                status: 'done' as const,
                time: i === index ? formatTime() : log.time,
              };
            }
            if (i === index + 1 && index < pending.length - 1) {
              return { ...log, status: 'active' as const };
            }
            return log;
          }),
        );

        if (index === pending.length - 1) {
          onComplete();
        }
      }, (index + 1) * 180);
      animationRef.current.push(timeout);
    });
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      clearAnimations();
      setIsProcessing(true);
      setPhase('processing');
      setMetadataVisible(false);
      setActiveMetadata(null);
      setLastProcessedFiles(files);

      const mode: UploadMode = files.length > 1 ? 'bulk' : 'single';
      setUploadMode(mode);

      const timestamp = formatNow();
      const initialQueue: UploadedDocument[] = files.map((file) => ({
        id: generateDocumentId(),
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: 'waiting',
        uploadedAt: timestamp,
        lastActionAt: timestamp,
      }));

      setQueue(initialQueue);

      const logTemplate =
        mode === 'bulk'
          ? createBulkProcessingLogs(files.length, 0)
          : createSingleProcessingLogs();
      setLogs(logTemplate.map((log, i) => (i === 0 ? { ...log, status: 'active' as const } : log)));

      await new Promise((resolve) => setTimeout(resolve, 400));

      const processedDocs: UploadedDocument[] = [];
      let reviewCount = 0;
      let lastMetadata: ExtractedMetadata | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docId = initialQueue[i].id;

        setQueue((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: 'processing' as const } : d)),
        );

        await new Promise((resolve) => setTimeout(resolve, mode === 'bulk' ? 500 : 600));

        try {
          const metadata = await processDocumentWithAI(file);
          const { queueStatus, historyStatus } = resolveStatuses(metadata);

          if (queueStatus === 'requires_review') reviewCount++;

          const processedDoc: UploadedDocument = {
            ...initialQueue[i],
            suggestedName: metadata.suggestedName,
            category: metadata.documentType,
            status: queueStatus,
            version: metadata.suggestedVersion,
            metadata,
            lastActionAt: formatNow(),
          };

          processedDocs.push(processedDoc);
          lastMetadata = metadata;

          setQueue((prev) => prev.map((d) => (d.id === docId ? processedDoc : d)));

          setHistory((prev) => [toHistoryItem(processedDoc, metadata, historyStatus), ...prev]);
        } catch {
          setQueue((prev) =>
            prev.map((d) => (d.id === docId ? { ...d, status: 'error' as const } : d)),
          );
        }
      }

      const finalLogs =
        mode === 'bulk'
          ? createBulkProcessingLogs(files.length, reviewCount)
          : createSingleProcessingLogs();

      if (mode === 'single' && lastMetadata) {
        setActiveMetadata(lastMetadata);
      } else if (mode === 'bulk' && processedDocs.length > 0) {
        const focus =
          processedDocs.find((d) => d.metadata)?.metadata ??
          processedDocs[processedDocs.length - 1]?.metadata ??
          null;
        setActiveMetadata(focus);
      }

      animateLogs(finalLogs, () => {
        setPhase('complete');
        setMetadataVisible(true);
        setIsProcessing(false);
      });
    },
    [animateLogs, clearAnimations],
  );

  const handleSubmit = () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecione ao menos um arquivo para enviar.');
      return;
    }
    void processFiles(selectedFiles);
  };

  const handleReprocess = () => {
    if (lastProcessedFiles.length === 0) return;
    void processFiles(lastProcessedFiles);
  };

  const handleClearForm = () => {
    clearAnimations();
    uploadCardRef.current?.reset();
    setSelectedFiles([]);
    setQueue([]);
    setPhase('idle');
    setIsProcessing(false);
    setActiveMetadata(null);
    setMetadataVisible(false);
    setLogs(createSingleProcessingLogs());
    setLastProcessedFiles([]);
  };

  const showClearButton =
    selectedFiles.length > 0 || queue.length > 0 || phase !== 'idle';

  return (
    <div className="h-auto w-full space-y-6">
      <PageHeader
        eyebrow="Processamento"
        title="Envio de Documentos"
        description="Envie arquivos para análise automática. Nomes e metadados são gerados após o processamento."
        actions={
          showClearButton ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleClearForm}
              className="border-doqyn-border bg-doqyn-surface hover:bg-doqyn-hover"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar formulário
            </Button>
          ) : undefined
        }
      />

      <div className="grid w-full shrink-0 grid-cols-1 items-stretch gap-5 min-[1280px]:grid-cols-2">
        <UploadCard
          ref={uploadCardRef}
          isProcessing={isProcessing}
          selectedFiles={selectedFiles}
          onFilesChange={setSelectedFiles}
          onValidationError={(msg) => toast.error(msg)}
          onSubmit={handleSubmit}
        />
        <UploadResultPanel
          phase={phase}
          metadata={activeMetadata}
          metadataVisible={metadataVisible}
          logs={logs}
          onReprocess={lastProcessedFiles.length > 0 ? handleReprocess : undefined}
        />
      </div>

      {uploadMode === 'bulk' && queue.length > 0 && <UploadQueue items={queue} />}

      <div className="shrink-0 border-t border-doqyn-border pt-5">
        <UploadHistoryTable items={history} />
      </div>
    </div>
  );
}
