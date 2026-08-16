import { Input } from '@/components/ui/Input';
import { Radio } from '@/components/ui/Radio';
import { cn } from '@/lib/utils';
import type { PerItemNamingChoice, WorkflowReviewSettings } from '../types/reviewWorkflowSettings';
import { policyRequiresPerItemChoice } from '../utils/reviewWorkflowSettings';
import type { DocumentNamingMode } from '../utils/resolveDocumentNaming';
import { previewFinalFileName } from '../utils/resolveDocumentNaming';

interface DocumentNamingSectionProps {
  settings: WorkflowReviewSettings;
  originalFileName: string;
  aiSuggestedFileName: string;
  perItemChoice: PerItemNamingChoice;
  onPerItemChoiceChange: (choice: PerItemNamingChoice) => void;
  className?: string;
}

const MODES: Array<{ id: DocumentNamingMode; label: string; description: string }> = [
  {
    id: 'ai_suggested',
    label: 'Nome sugerido pela IA',
    description: 'Padrão recomendado com metadados extraídos.',
  },
  {
    id: 'original',
    label: 'Nome original do upload',
    description: 'Mantém o arquivo como enviado (sanitizado).',
  },
  {
    id: 'manual',
    label: 'Nome manual',
    description: 'Digite o nome final desejado.',
  },
];

export function DocumentNamingSection({
  settings,
  originalFileName,
  aiSuggestedFileName,
  perItemChoice,
  onPerItemChoiceChange,
  className,
}: DocumentNamingSectionProps) {
  const manualRequired = settings.defaultNamingPolicy === 'manual_required';
  const askEachFile = policyRequiresPerItemChoice(settings.defaultNamingPolicy);
  const showPerItemRadios = askEachFile && !manualRequired;

  const effectiveMode: DocumentNamingMode = manualRequired
    ? 'manual'
    : !settings.aiRenameEnabled
      ? perItemChoice.namingMode === 'manual' && perItemChoice.manualName?.trim()
        ? 'manual'
        : 'original'
      : settings.defaultNamingPolicy === 'original'
        ? 'original'
        : settings.defaultNamingPolicy === 'ai_suggested' && !askEachFile
          ? 'ai_suggested'
          : perItemChoice.namingMode;

  const finalPreview = previewFinalFileName({
    originalFileName,
    aiSuggestedFileName,
    namingMode: effectiveMode,
    manualName: perItemChoice.manualName,
  });

  const setMode = (namingMode: DocumentNamingMode) => {
    onPerItemChoiceChange({ ...perItemChoice, namingMode });
  };

  const setManualName = (manualName: string) => {
    onPerItemChoiceChange({ namingMode: 'manual', manualName });
  };

  return (
    <div
      className={cn(
        'bg-doqyn-bg/30 space-y-3 rounded-lg border border-doqyn-border-subtle p-4',
        className,
      )}
    >
      <div>
        <p className="text-xs font-medium text-doqyn-text">Nome do arquivo salvo</p>
        {!settings.aiRenameEnabled && (
          <p className="mt-1 text-micro text-doqyn-muted">
            Sugestão da IA (opcional):{' '}
            <span className="font-mono text-doqyn-text">{aiSuggestedFileName || '—'}</span>
          </p>
        )}
      </div>

      {showPerItemRadios && (
        <div className="space-y-2" role="radiogroup" aria-label="Modo de nomeação do arquivo">
          {MODES.map((mode) => {
            const disabled = !settings.aiRenameEnabled && mode.id !== 'original';
            return (
              <Radio
                key={mode.id}
                name="document-naming-mode"
                checked={effectiveMode === mode.id}
                disabled={disabled}
                onChange={() => setMode(mode.id)}
                label={mode.label}
                description={mode.description}
                wrapperClassName={cn(
                  'rounded-md border px-3 py-2 transition-colors',
                  effectiveMode === mode.id
                    ? 'border-doqyn-primary/40 bg-doqyn-primary/10'
                    : 'border-doqyn-border-subtle bg-doqyn-surface/40',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              />
            );
          })}
        </div>
      )}

      {(manualRequired || effectiveMode === 'manual') && (
        <Input
          value={perItemChoice.manualName ?? ''}
          onChange={(event) => setManualName(event.target.value)}
          placeholder="Digite o nome final do arquivo"
          className="text-sm"
        />
      )}

      <div className="bg-doqyn-bg/50 rounded-md border border-doqyn-border-subtle px-3 py-2">
        <p className="text-eyebrow uppercase text-doqyn-muted">Preview do nome final</p>
        <p className="mt-1 break-all font-mono text-xs text-doqyn-text">{finalPreview}</p>
      </div>
    </div>
  );
}
