import { useState } from 'react';
import { FileSearch, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ExtractedMetadata, ProcessingLogItem } from '../types';
import { metadataToFields } from '../utils/documentNaming';
import { ConfidenceBadge } from './ConfidenceBadge';
import { TimelineItem } from './TimelineItem';

type UploadPhase = 'idle' | 'processing' | 'complete';

interface UploadResultPanelProps {
  phase: UploadPhase;
  metadata: ExtractedMetadata | null;
  metadataVisible: boolean;
  logs: ProcessingLogItem[];
  onReprocess?: () => void;
  className?: string;
}

export function UploadResultPanel({
  phase,
  metadata,
  metadataVisible,
  logs,
  onReprocess,
  className,
}: UploadResultPanelProps) {
  const [activeTab, setActiveTab] = useState<'resultado' | 'logs'>('resultado');

  const fields = metadata ? metadataToFields(metadata) : [];

  return (
    <Card
      className={cn(
        'flex h-full min-h-0 flex-col border-doqyn-border bg-doqyn-surface',
        className,
      )}
    >
      <CardHeader className="shrink-0 space-y-3 pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Metadados extraídos</CardTitle>
          {phase !== 'idle' && metadata && (
            <ConfidenceBadge score={metadata.confidenceScore} />
          )}
        </div>

        <div className="flex gap-1 border-b border-doqyn-border">
          <button
            type="button"
            onClick={() => setActiveTab('resultado')}
            className={cn(
              'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'resultado'
                ? 'border-doqyn-primary text-doqyn-text'
                : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            Resultado
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === 'logs'
                ? 'border-doqyn-primary text-doqyn-text'
                : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
            )}
          >
            Logs
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'logs' ? (
          <ol
            className="min-h-0 flex-1 space-y-0 overflow-y-auto scrollbar-thin"
            aria-label="Logs de processamento"
          >
            {logs.map((log, index) => (
              <TimelineItem key={log.id} log={log} isLast={index === logs.length - 1} />
            ))}
          </ol>
        ) : phase === 'idle' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-doqyn-bg/60">
              <FileSearch className="h-5 w-5 text-doqyn-muted" />
            </div>
            <p className="mt-4 max-w-[260px] text-sm text-doqyn-muted">
              Envie um documento para ver os metadados extraídos e o nome sugerido aqui.
            </p>
          </div>
        ) : phase === 'processing' ? (
          <ol
            className="min-h-0 flex-1 space-y-0 overflow-y-auto scrollbar-thin"
            aria-label="Progresso do processamento"
          >
            {logs.map((log, index) => (
              <TimelineItem
                key={log.id}
                log={{ ...log, description: log.description || '' }}
                isLast={index === logs.length - 1}
              />
            ))}
          </ol>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                'flex-1 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 transition-opacity duration-300',
                !metadataVisible && 'opacity-40',
              )}
            >
              <table className="w-full text-sm">
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.label} className="border-b border-doqyn-border-subtle last:border-0">
                      <td className="px-4 py-2.5 text-xs text-doqyn-muted">{field.label}</td>
                      <td
                        className={cn(
                          'px-4 py-2.5 text-right text-sm font-medium text-doqyn-text',
                          field.label === 'Nome sugerido' && 'font-mono text-xs',
                        )}
                      >
                        {metadataVisible ? field.value : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {metadataVisible && metadata && (
              <p className="mt-3 text-xs text-doqyn-muted">
                O nome foi sugerido com base no conteúdo identificado.
              </p>
            )}

            <div className="mt-auto shrink-0 space-y-2 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full border-doqyn-border bg-transparent hover:bg-doqyn-hover"
                disabled={!metadataVisible}
              >
                Confirmar metadados
              </Button>
              {onReprocess && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onReprocess}
                  disabled={!metadataVisible}
                  className="w-full text-doqyn-muted hover:text-doqyn-text"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reprocessar análise
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
