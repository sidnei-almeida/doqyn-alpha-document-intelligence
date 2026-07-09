import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Radio } from '@/components/ui/Radio';
import { SettingsFieldGroup } from '@/features/settings/components/SettingsFieldGroup';
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
  /** inline = formulário expandido (página de configurações); dropdown = popover compacto. */
  variant?: 'dropdown' | 'inline';
}

const NAMING_POLICIES: DefaultNamingPolicy[] = [
  'original',
  'ai_suggested',
  'ask_each_file',
  'manual_required',
];

function CollapsibleSettingsSection({
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
        <Icon
          name="expand_more"
          size={14}
          className={cn('text-doqyn-muted transition-transform', open && 'rotate-180')}
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
  size?: 'compact' | 'comfortable';
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      label={label}
      description={description}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function NamingPolicyOptions({
  value,
  onChange,
}: {
  value: DefaultNamingPolicy;
  onChange: (policy: DefaultNamingPolicy) => void;
  size?: 'compact' | 'comfortable';
}) {
  return (
    <div className="settings-choice-list" role="radiogroup" aria-label="Política de nomeação padrão">
      {NAMING_POLICIES.map((policy) => (
        <Radio
          key={policy}
          name="default-naming-policy"
          checked={value === policy}
          onChange={() => onChange(policy)}
          label={NAMING_POLICY_LABELS[policy]}
          wrapperClassName={cn(
            'settings-choice-item',
            value === policy && 'settings-choice-item--active',
          )}
        />
      ))}
    </div>
  );
}

function AutoReviewControls({
  settings,
  patch,
  adjustDelay,
  size = 'compact',
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  adjustDelay: (delta: number) => void;
  size?: 'compact' | 'comfortable';
}) {
  return (
    <>
      <ToggleRow
        label="Ativar modo automático"
        description="Aceita análises confiáveis após o tempo configurado."
        checked={settings.autoReviewEnabled}
        onChange={(checked) => patch({ autoReviewEnabled: checked })}
        size={size}
      />
      {settings.autoReviewEnabled && (
        <div className="settings-stepper-row">
          <span className="settings-stepper-row__label">Aguardar</span>
          <div className="settings-stepper">
            <button
              type="button"
              disabled={settings.autoAcceptDelaySeconds <= AUTO_DELAY_SECONDS_MIN}
              onClick={() => adjustDelay(-1)}
              className="settings-stepper__btn"
              aria-label="Diminuir segundos"
            >
              <Icon name="remove" size={14} />
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
              className="settings-stepper__input"
              aria-label="Segundos antes da revisão automática"
            />
            <button
              type="button"
              disabled={settings.autoAcceptDelaySeconds >= AUTO_DELAY_SECONDS_MAX}
              onClick={() => adjustDelay(1)}
              className="settings-stepper__btn"
              aria-label="Aumentar segundos"
            >
              <Icon name="add" size={14} />
            </button>
          </div>
          <span className="settings-stepper-row__suffix">seg</span>
        </div>
      )}
      <ToggleRow
        label="Exigir revisão manual em baixa confiança"
        checked={settings.pauseOnLowConfidence}
        onChange={(checked) => patch({ pauseOnLowConfidence: checked })}
        size={size}
      />
      <ToggleRow
        label="Exigir revisão manual com campos ausentes"
        checked={settings.pauseOnMissingFields}
        onChange={(checked) => patch({ pauseOnMissingFields: checked })}
        size={size}
      />
      <ToggleRow
        label="Exigir revisão para documentos sensíveis"
        description="Em breve — detecção automática de contratos e dados pessoais."
        checked={settings.pauseOnSensitiveDocs}
        onChange={(checked) => patch({ pauseOnSensitiveDocs: checked })}
        disabled
        size={size}
      />
    </>
  );
}

function AiSuggestionControls({
  settings,
  patch,
  size = 'compact',
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  size?: 'compact' | 'comfortable';
}) {
  return (
    <>
      <ToggleRow
        label="Permitir IA sugerir nome padronizado"
        checked={settings.aiRenameEnabled}
        onChange={(checked) => patch({ aiRenameEnabled: checked })}
        size={size}
      />
      <ToggleRow
        label="Permitir IA preencher metadados"
        description="Análise sempre executa; toggle prepara fase futura."
        checked={settings.aiMetadataEnabled}
        onChange={(checked) => patch({ aiMetadataEnabled: checked })}
        size={size}
      />
      <ToggleRow
        label="Permitir IA sugerir categoria/classe"
        description="Análise sempre executa; toggle prepara fase futura."
        checked={settings.aiClassificationEnabled}
        onChange={(checked) => patch({ aiClassificationEnabled: checked })}
        size={size}
      />
      <ToggleRow
        label="Nunca incluir CPF/CNPJ no nome sugerido"
        checked={settings.preventSensitiveDataInFileName}
        onChange={(checked) => patch({ preventSensitiveDataInFileName: checked })}
        size={size}
      />
    </>
  );
}

function BatchControls({
  settings,
  patch,
  size = 'compact',
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  size?: 'compact' | 'comfortable';
}) {
  return (
    <>
      <ToggleRow
        label="Aplicar esta configuração aos próximos arquivos do lote"
        checked={settings.applyToBatch}
        onChange={(checked) => patch({ applyToBatch: checked })}
        size={size}
      />
      <ToggleRow
        label="Parar para revisão quando houver conflito"
        checked={settings.pauseOnConflict}
        onChange={(checked) => patch({ pauseOnConflict: checked })}
        size={size}
      />
      <ToggleRow
        label="Continuar automaticamente quando estiver seguro"
        checked={settings.continueWhenSafe}
        onChange={(checked) => patch({ continueWhenSafe: checked })}
        size={size}
      />
    </>
  );
}

export function ReviewWorkflowSettingsPanel({
  settings,
  onChange,
  disabled = false,
  className,
  variant = 'dropdown',
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
    if (!open || variant === 'inline') return;
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
  }, [open, variant]);

  const dropdownBody = (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto scrollbar-thin">
      <CollapsibleSettingsSection title="Revisão automática">
        <AutoReviewControls
          settings={settings}
          patch={patch}
          adjustDelay={adjustDelay}
        />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Nome do documento">
        <NamingPolicyOptions
            value={settings.defaultNamingPolicy}
            onChange={(policy) => patch({ defaultNamingPolicy: policy })}
          />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Sugestões da IA">
        <AiSuggestionControls settings={settings} patch={patch} />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Upload em lote">
        <BatchControls settings={settings} patch={patch} />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title="Segurança">
        <p className="text-[11px] leading-relaxed text-doqyn-muted">
          Nomes são sanitizados (sem barras ou path traversal), limitados a ~180 caracteres e
          forçados para extensão .pdf. CPF/CNPJ não entram automaticamente no nome sugerido quando
          a proteção está ativa.
        </p>
      </CollapsibleSettingsSection>
    </div>
  );

  const inlineBody = (
    <div className="settings-workflow-panel">
      <SettingsFieldGroup
        title="Revisão automática"
        description="Define quando a análise pode seguir sem intervenção manual."
      >
        <AutoReviewControls
          settings={settings}
          patch={patch}
          adjustDelay={adjustDelay}
          size="comfortable"
        />
      </SettingsFieldGroup>

      <div className="settings-workflow-panel__grid">
        <SettingsFieldGroup
          title="Nome do documento"
          description="Política padrão aplicada após a análise da IA."
        >
          <NamingPolicyOptions
            value={settings.defaultNamingPolicy}
            onChange={(policy) => patch({ defaultNamingPolicy: policy })}
            size="comfortable"
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup
          title="Sugestões da IA"
          description="Controle o que a IA pode sugerir automaticamente."
        >
          <AiSuggestionControls settings={settings} patch={patch} size="comfortable" />
        </SettingsFieldGroup>
      </div>

      <div className="settings-workflow-panel__grid">
        <SettingsFieldGroup
          title="Upload em lote"
          description="Comportamento ao enviar vários arquivos de uma vez."
        >
          <BatchControls settings={settings} patch={patch} size="comfortable" />
        </SettingsFieldGroup>

        <SettingsFieldGroup
          title="Proteção de nomes"
          description="Regras de sanitização aplicadas aos nomes sugeridos."
        >
          <p className="text-sm leading-relaxed text-doqyn-muted">
            Nomes são sanitizados (sem barras ou path traversal), limitados a aproximadamente 180
            caracteres e forçados para extensão .pdf. CPF/CNPJ não entram automaticamente no nome
            sugerido quando a proteção está ativa.
          </p>
        </SettingsFieldGroup>
      </div>
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className={cn(className)} data-testid="upload-workflow-settings-inline">
        {inlineBody}
      </div>
    );
  }

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
        <Icon name="tune" size={14} className="shrink-0 text-doqyn-primary" />
        <span>Configurações da revisão</span>
        {summary && (
          <Badge variant="default" className="text-[10px]">
            {summary}
          </Badge>
        )}
        <Icon
          name="expand_more"
          size={14}
          className={cn('text-doqyn-muted transition-transform', open && 'rotate-180')}
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
          {dropdownBody}
        </div>
      )}
    </div>
  );
}
