import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ExtractedMetadata } from '../types';
import { formatFileSize } from '../utils/validateUpload';

interface AnalyzedDocumentCardProps {
  file: File;
  metadata: ExtractedMetadata;
  onReprocess: () => void;
  onNewDocument: () => void;
  isProcessing?: boolean;
  className?: string;
}

function getAnalysisStatusLabel(metadata: ExtractedMetadata): string {
  if (metadata.savedDocumentId) {
    return 'Metadados confirmados';
  }

  if (metadata.analysisStatus === 'requires_review') {
    return 'Requer revisão';
  }

  if (metadata.analysisStatus === 'ai_unavailable') {
    return 'Análise automática indisponível';
  }

  if (metadata.analysisStatus === 'completed') {
    return 'Análise concluída';
  }

  return 'Erro na análise';
}

export function AnalyzedDocumentCard({
  file,
  metadata,
  onReprocess,
  onNewDocument,
  isProcessing = false,
  className,
}: AnalyzedDocumentCardProps) {
  return (
    <Card
      className={cn(
        'h-fit w-full self-start border-doqyn-border bg-doqyn-surface',
        className,
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Documento analisado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-surface-soft">
            <Icon name="description" size={ICON_SIZE.nav} className="text-doqyn-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-doqyn-muted">Arquivo original</p>
            <TruncatedText as="p" className="text-sm font-medium text-doqyn-text">
              {file.name}
            </TruncatedText>
            <p className="mt-1 text-xs text-doqyn-muted">{formatFileSize(file.size)}</p>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-doqyn-muted">Status da análise</dt>
            <dd className="mt-0.5 font-medium text-doqyn-text">
              {getAnalysisStatusLabel(metadata)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-doqyn-muted">Nome sugerido</dt>
            <dd className="mt-0.5 font-mono text-xs text-doqyn-text">
              <TruncatedText>{metadata.suggestedName}</TruncatedText>
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 border-t border-doqyn-border-subtle pt-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full border-doqyn-border bg-transparent hover:bg-doqyn-hover"
            onClick={onReprocess}
            disabled={isProcessing}
          >
            <Icon name="refresh" size={ICON_SIZE.xs} />
            Reprocessar análise
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-doqyn-muted hover:text-doqyn-text"
            onClick={onNewDocument}
            disabled={isProcessing}
          >
            Novo documento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
