import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { DefaultNamingPolicy, WorkflowReviewSettings } from '../types/reviewWorkflowSettings';
import {
  AUTO_DELAY_SECONDS_MAX,
  AUTO_DELAY_SECONDS_MIN,
  clampAutoDelaySeconds,
} from '../uploadConstants';
import {
  getReviewSettingsSummaryLabel,
  NAMING_POLICY_LABELS,
} from '../utils/reviewWorkflowSettings';

interface ReviewWorkflowSettingsPanelProps {
  settings: WorkflowReviewSettings;
  onChange: (settings: WorkflowReviewSettings) => void;
  disabled?: boolean;
  className?: string;
}

const NAMING_POLICIES: DefaultNamingPolicy[] = [
  'original',
  'ai_suggested',
  'ask_each_file',
  'manual_required',
];

function SettingsSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-doqyn-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-doqyn-text hover:bg-doqyn-hover/50"
      >
        {title}
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-doqyn-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="space-y-2 px-4 pb-3">{children}</div>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2 text-xs',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 rounded border-doqyn-border"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="font-medium text-doqyn-text">{label}</span>
        {description && <span className="mt-0.5 block text-doqyn-muted">{description}</span>}
      </span>
    </label>
  );
}

export function ReviewWorkflowSettingsPanel({
  settings,
  onChange,
  disabled = false,
  className,
}: ReviewWorkflowSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const summary = getReviewSettingsSummaryLabel(settings);

  const patch = (partial: Partial<WorkflowReviewSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const adjustDelay = (delta: number) => {
    patch({
      autoAcceptDelaySeconds: clampAutoDelaySeconds(settings.autoAcceptDelaySeconds + delta),
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex max-w-full items-center gap-2 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2 text-xs font-medium text-doqyn-text transition-colors hover:bg-doqyn-hover/50',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'border-doqyn-primary/40 bg-doqyn-primary/10',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings2 className="h-3.5 w-3.5 shrink-0 text-doqyn-primary" />
        <span>Configurações da revisão</span>
        {summary && (
          <Badge variant="default" className="text-[10px]">
            {summary}
          </Badge>
        )}
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-doqyn-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Configurações da revisão"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface shadow-xl"
        >
          <div className="border-b border-doqyn-border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-doqyn-text">Configurações da revisão</p>
            <p className="mt-0.5 text-[11px] text-doqyn-muted">
              Controle revisão automática, nomeação e comportamento em lote nesta sessão.
            </p>
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto scrollbar-thin">
            <SettingsSection title="Revisão automática" defaultOpen>
              <ToggleRow
                label="Ativar modo automático"
                description="Aceita análises confiáveis após o tempo configurado."
                checked={settings.autoReviewEnabled}
                onChange={(checked) => patch({ autoReviewEnabled: checked })}
              />
              {settings.autoReviewEnabled && (
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-[11px] text-doqyn-muted">Aguardar</span>
                  <div className="flex items-center rounded-md border border-doqyn-border bg-doqyn-bg">
                    <button
                      type="button"
                      disabled={settings.autoAcceptDelaySeconds <= AUTO_DELAY_SECONDS_MIN}
                      onClick={() => adjustDelay(-1)}
                      className="flex h-7 w-7 items-center justify-center text-doqyn-muted hover:text-doqyn-text disabled:opacity-30"
                      aria-label="Diminuir segundos"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      min={AUTO_DELAY_SECONDS_MIN}
                      max={AUTO_DELAY_SECONDS_MAX}
                      value={settings.autoAcceptDelaySeconds}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (!Number.isNaN(parsed)) {
                          patch({ autoAcceptDelaySeconds: clampAutoDelaySeconds(parsed) });
                        }
                      }}
                      className="h-7 w-10 border-x border-doqyn-border bg-transparent text-center text-xs font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      disabled={settings.autoAcceptDelaySeconds >= AUTO_DELAY_SECONDS_MAX}
                      onClick={() => adjustDelay(1)}
                      className="flex h-7 w-7 items-center justify-center text-doqyn-muted hover:text-doqyn-text disabled:opacity-30"
                      aria-label="Aumentar segundos"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-[11px] text-doqyn-muted">seg</span>
                </div>
              )}
              <ToggleRow
                label="Exigir revisão manual em baixa confiança"
                checked={settings.pauseOnLowConfidence}
                onChange={(checked) => patch({ pauseOnLowConfidence: checked })}
              />
              <ToggleRow
                label="Exigir revisão manual com campos ausentes"
                checked={settings.pauseOnMissingFields}
                onChange={(checked) => patch({ pauseOnMissingFields: checked })}
              />
              <ToggleRow
                label="Exigir revisão para documentos sensíveis"
                description="Em breve — detecção automática de contratos/PII."
                checked={settings.pauseOnSensitiveDocs}
                onChange={(checked) => patch({ pauseOnSensitiveDocs: checked })}
                disabled
              />
            </SettingsSection>

            <SettingsSection title="Nome do documento">
              <div className="space-y-1.5">
                {NAMING_POLICIES.map((policy) => (
                  <label
                    key={policy}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
                      settings.defaultNamingPolicy === policy
                        ? 'border-doqyn-primary/40 bg-doqyn-primary/10'
                        : 'border-doqyn-border-subtle',
                    )}
                  >
                    <input
                      type="radio"
                      name="default-naming-policy"
                      className="mt-0.5"
                      checked={settings.defaultNamingPolicy === policy}
                      onChange={() => patch({ defaultNamingPolicy: policy })}
                    />
                    <span className="text-doqyn-text">{NAMING_POLICY_LABELS[policy]}</span>
                  </label>
                ))}
              </div>
            </SettingsSection>

            <SettingsSection title="Sugestões da IA">
              <ToggleRow
                label="Permitir IA sugerir nome padronizado"
                checked={settings.aiRenameEnabled}
                onChange={(checked) => patch({ aiRenameEnabled: checked })}
              />
              <ToggleRow
                label="Permitir IA preencher metadados"
                description="Análise sempre executa; toggle prepara fase futura."
                checked={settings.aiMetadataEnabled}
                onChange={(checked) => patch({ aiMetadataEnabled: checked })}
              />
              <ToggleRow
                label="Permitir IA sugerir categoria/classe"
                description="Análise sempre executa; toggle prepara fase futura."
                checked={settings.aiClassificationEnabled}
                onChange={(checked) => patch({ aiClassificationEnabled: checked })}
              />
              <ToggleRow
                label="Nunca incluir CPF/CNPJ no nome sugerido"
                checked={settings.preventSensitiveDataInFileName}
                onChange={(checked) => patch({ preventSensitiveDataInFileName: checked })}
              />
            </SettingsSection>

            <SettingsSection title="Upload em lote">
              <ToggleRow
                label="Aplicar esta configuração aos próximos arquivos do lote"
                checked={settings.applyToBatch}
                onChange={(checked) => patch({ applyToBatch: checked })}
              />
              <ToggleRow
                label="Parar para revisão quando houver conflito"
                checked={settings.pauseOnConflict}
                onChange={(checked) => patch({ pauseOnConflict: checked })}
              />
              <ToggleRow
                label="Continuar automaticamente quando estiver seguro"
                checked={settings.continueWhenSafe}
                onChange={(checked) => patch({ continueWhenSafe: checked })}
              />
            </SettingsSection>

            <SettingsSection title="Segurança">
              <p className="text-[11px] leading-relaxed text-doqyn-muted">
                Nomes são sanitizados (sem barras ou path traversal), limitados a ~180 caracteres e
                forçados para extensão .pdf. CPF/CNPJ não entram automaticamente no nome sugerido
                quando a proteção está ativa.
              </p>
            </SettingsSection>
          </div>
        </div>
      )}
    </div>
  );
}
