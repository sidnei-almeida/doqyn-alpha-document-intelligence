import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Radio } from '@/components/ui/Radio';
import { SettingsFieldGroup } from '@/features/settings/components/SettingsFieldGroup';
import { SettingsStatusBadge } from '@/features/settings/components/SettingsStatusBadge';
import { cn } from '@/lib/utils';
import type { DefaultNamingPolicy, WorkflowReviewSettings } from '../types/reviewWorkflowSettings';
import {
  AUTO_DELAY_SECONDS_MAX,
  AUTO_DELAY_SECONDS_MIN,
  clampAutoDelaySeconds,
} from '../uploadConstants';
import {
  getReviewSettingsSummaryLabel,
  NAMING_POLICY_DESCRIPTIONS,
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
        className="hover:bg-doqyn-hover/50 flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-doqyn-text"
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
  wrapperClassName,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  wrapperClassName?: string;
  size?: 'compact' | 'comfortable';
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      label={label}
      description={description}
      onChange={(event) => onChange(event.target.checked)}
      wrapperClassName={wrapperClassName}
    />
  );
}

function ComingSoonToggleRow({
  label,
  description,
  checked,
}: {
  label: string;
  description?: string;
  checked: boolean;
}) {
  return (
    <div className="settings-locked-option">
      <Checkbox
        checked={checked}
        disabled
        label={label}
        description={description}
        onChange={() => undefined}
        wrapperClassName="settings-locked-option__control"
      />
      <SettingsStatusBadge status="pending" className="settings-locked-option__badge" />
    </div>
  );
}

function NamingPolicyOptions({
  value,
  onChange,
  compact = false,
}: {
  value: DefaultNamingPolicy;
  onChange: (policy: DefaultNamingPolicy) => void;
  compact?: boolean;
  size?: 'compact' | 'comfortable';
}) {
  return (
    <div
      className={cn('settings-choice-list', compact && 'settings-choice-list--compact')}
      role="radiogroup"
      aria-label="Política de nomeação padrão"
    >
      {NAMING_POLICIES.map((policy) => (
        <Radio
          key={policy}
          name="default-naming-policy"
          checked={value === policy}
          onChange={() => onChange(policy)}
          label={
            compact ? (
              <span className="settings-choice-item__inline">
                <span className="settings-choice-item__label">{NAMING_POLICY_LABELS[policy]}</span>
                <span className="settings-choice-item__sep" aria-hidden>
                  —
                </span>
                <span className="settings-choice-item__hint">
                  {NAMING_POLICY_DESCRIPTIONS[policy]}
                </span>
              </span>
            ) : (
              NAMING_POLICY_LABELS[policy]
            )
          }
          wrapperClassName={cn(
            compact ? 'settings-choice-item--compact' : 'settings-choice-item',
            !compact && value === policy && 'settings-choice-item--active',
            compact && value === policy && 'settings-choice-item--compact-active',
          )}
        />
      ))}
    </div>
  );
}

function AutoDelayStepper({
  settings,
  patch,
  adjustDelay,
  disabled = false,
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  adjustDelay: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('settings-stepper-row', disabled && 'settings-stepper-row--disabled')}>
      <span className="settings-stepper-row__label">Aguardar</span>
      <div className="settings-stepper">
        <button
          type="button"
          disabled={disabled || settings.autoAcceptDelaySeconds <= AUTO_DELAY_SECONDS_MIN}
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
          disabled={disabled}
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
          disabled={disabled || settings.autoAcceptDelaySeconds >= AUTO_DELAY_SECONDS_MAX}
          onClick={() => adjustDelay(1)}
          className="settings-stepper__btn"
          aria-label="Aumentar segundos"
        >
          <Icon name="add" size={14} />
        </button>
      </div>
      <span className="settings-stepper-row__suffix">seg</span>
    </div>
  );
}

function AutoReviewControls({
  settings,
  patch,
  adjustDelay,
  nested = false,
  size = 'compact',
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  adjustDelay: (delta: number) => void;
  nested?: boolean;
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
      {nested ? (
        <div
          className={cn(
            'settings-dependent-group',
            !settings.autoReviewEnabled && 'settings-dependent-group--inactive',
          )}
        >
          <AutoDelayStepper
            settings={settings}
            patch={patch}
            adjustDelay={adjustDelay}
            disabled={!settings.autoReviewEnabled}
          />
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
          <ComingSoonToggleRow
            label="Exigir revisão para documentos sensíveis"
            description="Detecção automática de contratos e dados pessoais."
            checked={settings.pauseOnSensitiveDocs}
          />
        </div>
      ) : (
        <>
          {settings.autoReviewEnabled ? (
            <AutoDelayStepper settings={settings} patch={patch} adjustDelay={adjustDelay} />
          ) : null}
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
      )}
    </>
  );
}

function AiSuggestionControls({
  settings,
  patch,
  lockedFuture = false,
  size = 'compact',
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  lockedFuture?: boolean;
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
      {lockedFuture ? (
        <>
          <ComingSoonToggleRow
            label="Permitir IA preencher metadados"
            description="A análise já executa; o controle fica para uma fase futura."
            checked={settings.aiMetadataEnabled}
          />
          <ComingSoonToggleRow
            label="Permitir IA sugerir categoria/classe"
            description="A análise já executa; o controle fica para uma fase futura."
            checked={settings.aiClassificationEnabled}
          />
        </>
      ) : (
        <>
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
        </>
      )}
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
    <div className="scrollbar-thin max-h-[min(70vh,28rem)] overflow-y-auto">
      <CollapsibleSettingsSection title="Revisão automática">
        <AutoReviewControls settings={settings} patch={patch} adjustDelay={adjustDelay} />
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
        <p className="text-micro leading-relaxed text-doqyn-muted">
          Nomes são sanitizados (sem barras ou path traversal), limitados a ~180 caracteres e
          forçados para extensão .pdf. CPF/CNPJ não entram automaticamente no nome sugerido quando a
          proteção está ativa.
        </p>
      </CollapsibleSettingsSection>
    </div>
  );

  const inlineBody = (
    <div className="settings-workflow-panel">
      <div className="settings-workflow-panel__grid settings-workflow-panel__grid--balanced">
        <SettingsFieldGroup
          title="Revisão automática"
          description="Define quando a análise pode seguir sem intervenção manual."
          className="settings-field-group--fill"
        >
          <AutoReviewControls
            settings={settings}
            patch={patch}
            adjustDelay={adjustDelay}
            nested
            size="comfortable"
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup
          title="Sugestões da IA"
          description="Controle o que a IA pode sugerir automaticamente."
          className="settings-field-group--fill"
        >
          <AiSuggestionControls settings={settings} patch={patch} lockedFuture size="comfortable" />
        </SettingsFieldGroup>

        <SettingsFieldGroup
          title="Nome do documento"
          description="Política padrão aplicada após a análise da IA."
          className="settings-field-group--fill"
        >
          <NamingPolicyOptions
            value={settings.defaultNamingPolicy}
            onChange={(policy) => patch({ defaultNamingPolicy: policy })}
            compact
            size="comfortable"
          />
        </SettingsFieldGroup>

        <SettingsFieldGroup
          title="Upload em lote"
          description="Comportamento ao enviar vários arquivos de uma vez."
          className="settings-field-group--fill"
        >
          <BatchControls settings={settings} patch={patch} size="comfortable" />
          <div className="settings-inline-note">
            <p className="settings-inline-note__title">Proteção de nomes</p>
            <p className="settings-inline-note__body">
              Nomes são sanitizados (sem barras ou path traversal), limitados a aproximadamente 180
              caracteres e forçados para extensão .pdf. CPF/CNPJ não entram automaticamente no nome
              sugerido quando a proteção está ativa.
            </p>
          </div>
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
          'bg-doqyn-bg/40 hover:bg-doqyn-hover/50 inline-flex max-w-full items-center gap-2 rounded-lg border border-doqyn-border-subtle px-3 py-2 text-xs font-medium text-doqyn-text transition-colors',
          disabled && 'cursor-not-allowed opacity-50',
          open && 'border-doqyn-primary/40 bg-doqyn-primary/10',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="tune" size={14} className="shrink-0 text-doqyn-primary" />
        <span>Configurações da revisão</span>
        {summary && (
          <Badge variant="default" className="text-micro">
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
            <p className="mt-0.5 text-micro text-doqyn-muted">
              Controle revisão automática, nomeação e comportamento em lote nesta sessão.
            </p>
          </div>
          {dropdownBody}
        </div>
      )}
    </div>
  );
}
