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
  NAMING_POLICY_DESCRIPTIONS,
  NAMING_POLICY_LABELS,
} from '../utils/reviewWorkflowSettings';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('documentSend');

  return (
    <div
      className={cn('settings-choice-list', compact && 'settings-choice-list--compact')}
      role="radiogroup"
      aria-label={t('reviewWorkflowSettingsPanel.politicaDeNomeacaoPadrao')}
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
  const { t } = useTranslation('documentSend');

  return (
    <div className={cn('settings-stepper-row', disabled && 'settings-stepper-row--disabled')}>
      <span className="settings-stepper-row__label">
        {t('reviewWorkflowSettingsPanel.aguardar')}
      </span>
      <div className="settings-stepper">
        <button
          type="button"
          disabled={disabled || settings.autoAcceptDelaySeconds <= AUTO_DELAY_SECONDS_MIN}
          onClick={() => adjustDelay(-1)}
          className="settings-stepper__btn"
          aria-label={t('reviewWorkflowSettingsPanel.diminuirSegundos')}
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
          aria-label={t('reviewWorkflowSettingsPanel.segundosAntesDaRevisao')}
        />
        <button
          type="button"
          disabled={disabled || settings.autoAcceptDelaySeconds >= AUTO_DELAY_SECONDS_MAX}
          onClick={() => adjustDelay(1)}
          className="settings-stepper__btn"
          aria-label={t('reviewWorkflowSettingsPanel.aumentarSegundos')}
        >
          <Icon name="add" size={14} />
        </button>
      </div>
      <span className="settings-stepper-row__suffix">
        {t('reviewWorkflowSettingsPanel.secondsSuffix')}
      </span>
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
  const { t } = useTranslation('documentSend');

  return (
    <>
      <ToggleRow
        label={t('reviewWorkflowSettingsPanel.ativarModoAutomatico')}
        description={t('reviewWorkflowSettingsPanel.aceitaAnalisesConfiaveisApos')}
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
            label={t('reviewWorkflowSettingsPanel.exigirRevisaoManualEm')}
            checked={settings.pauseOnLowConfidence}
            onChange={(checked) => patch({ pauseOnLowConfidence: checked })}
            size={size}
          />
          <ToggleRow
            label={t('reviewWorkflowSettingsPanel.exigirRevisaoManualCom')}
            checked={settings.pauseOnMissingFields}
            onChange={(checked) => patch({ pauseOnMissingFields: checked })}
            size={size}
          />
        </div>
      ) : (
        <>
          {settings.autoReviewEnabled ? (
            <AutoDelayStepper settings={settings} patch={patch} adjustDelay={adjustDelay} />
          ) : null}
          <ToggleRow
            label={t('reviewWorkflowSettingsPanel.exigirRevisaoManualEm2')}
            checked={settings.pauseOnLowConfidence}
            onChange={(checked) => patch({ pauseOnLowConfidence: checked })}
            size={size}
          />
          <ToggleRow
            label={t('reviewWorkflowSettingsPanel.exigirRevisaoManualCom2')}
            checked={settings.pauseOnMissingFields}
            onChange={(checked) => patch({ pauseOnMissingFields: checked })}
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
  size = 'compact',
}: {
  settings: WorkflowReviewSettings;
  patch: (partial: Partial<WorkflowReviewSettings>) => void;
  size?: 'compact' | 'comfortable';
}) {
  const { t } = useTranslation('documentSend');

  return (
    <>
      <ToggleRow
        label={t('reviewWorkflowSettingsPanel.permitirIaSugerirNome')}
        checked={settings.aiRenameEnabled}
        onChange={(checked) => patch({ aiRenameEnabled: checked })}
        size={size}
      />
      <ToggleRow
        label={t('reviewWorkflowSettingsPanel.nuncaIncluirCpfCnpj')}
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
  const { t } = useTranslation('documentSend');

  return (
    <>
      <ToggleRow
        label={t('reviewWorkflowSettingsPanel.aplicarEstaConfiguracaoAos')}
        checked={settings.applyToBatch}
        onChange={(checked) => patch({ applyToBatch: checked })}
        size={size}
      />
      <ToggleRow
        label={t('reviewWorkflowSettingsPanel.pararParaRevisaoQuando')}
        checked={settings.pauseOnConflict}
        onChange={(checked) => patch({ pauseOnConflict: checked })}
        size={size}
      />
      <ToggleRow
        label={t('reviewWorkflowSettingsPanel.continuarAutomaticamenteQuandoEstiver')}
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
  const { t } = useTranslation('documentSend');

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const summary = getReviewSettingsSummaryLabel(settings);

  const patch = (partial: Partial<WorkflowReviewSettings>) => {
    if (disabled) return;
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
      <CollapsibleSettingsSection title={t('reviewWorkflowSettingsPanel.revisaoAutomatica')}>
        <AutoReviewControls settings={settings} patch={patch} adjustDelay={adjustDelay} />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title={t('reviewWorkflowSettingsPanel.nomeDoDocumento')}>
        <NamingPolicyOptions
          value={settings.defaultNamingPolicy}
          onChange={(policy) => patch({ defaultNamingPolicy: policy })}
        />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title={t('reviewWorkflowSettingsPanel.sugestoesDaIa')}>
        <AiSuggestionControls settings={settings} patch={patch} />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title={t('reviewWorkflowSettingsPanel.uploadEmLote')}>
        <BatchControls settings={settings} patch={patch} />
      </CollapsibleSettingsSection>
      <CollapsibleSettingsSection title={t('reviewWorkflowSettingsPanel.seguranca')}>
        <p className="text-micro leading-relaxed text-doqyn-muted">
          {t('reviewWorkflowSettingsPanel.nomesSaoSanitizadosSem')}
        </p>
      </CollapsibleSettingsSection>
    </div>
  );

  // `fieldset disabled` desliga todo controle aninhado de uma vez — é o que sustenta a leitura
  // da política por quem não administra a organização, sem duplicar a prop em cada linha.
  const inlineBody = (
    <fieldset disabled={disabled} className="settings-workflow-panel">
      <div className="settings-workflow-panel__grid settings-workflow-panel__grid--balanced">
        <SettingsFieldGroup
          title={t('reviewWorkflowSettingsPanel.revisaoAutomatica2')}
          description={t('reviewWorkflowSettingsPanel.defineQuandoAAnalise')}
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
          title={t('reviewWorkflowSettingsPanel.sugestoesDaIa2')}
          description={t('reviewWorkflowSettingsPanel.controleOQueA')}
          className="settings-field-group--fill"
        >
          <AiSuggestionControls settings={settings} patch={patch} size="comfortable" />
        </SettingsFieldGroup>

        <SettingsFieldGroup
          title={t('reviewWorkflowSettingsPanel.nomeDoDocumento2')}
          description={t('reviewWorkflowSettingsPanel.politicaPadraoAplicadaApos')}
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
          title={t('reviewWorkflowSettingsPanel.uploadEmLote2')}
          description={t('reviewWorkflowSettingsPanel.comportamentoAoEnviarVarios')}
          className="settings-field-group--fill"
        >
          <BatchControls settings={settings} patch={patch} size="comfortable" />
          <div className="settings-inline-note">
            <p className="settings-inline-note__title">
              {t('reviewWorkflowSettingsPanel.protecaoDeNomes')}
            </p>
            <p className="settings-inline-note__body">
              {t('reviewWorkflowSettingsPanel.nomesSaoSanitizadosSem2')}
            </p>
          </div>
        </SettingsFieldGroup>
      </div>
    </fieldset>
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
        <span>{t('reviewWorkflowSettingsPanel.configuracoesDaRevisao')}</span>
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
          aria-label={t('reviewWorkflowSettingsPanel.configuracoesDaRevisao2')}
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface shadow-xl"
        >
          <div className="border-b border-doqyn-border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-doqyn-text">
              {t('reviewWorkflowSettingsPanel.configuracoesDaRevisao3')}
            </p>
            <p className="mt-0.5 text-micro text-doqyn-muted">
              {t('reviewWorkflowSettingsPanel.controleRevisaoAutomaticaNomeacao')}
            </p>
          </div>
          {dropdownBody}
        </div>
      )}
    </div>
  );
}
