import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DateField } from '@/components/ui/DateField';
import { Checkbox } from '@/components/ui/Checkbox';
import { WhatsappInput } from '@/components/ui/WhatsappInput';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { SegmentedTextToggle } from '@/components/ui/SegmentedTextToggle';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { WHATSAPP_PLACEHOLDER } from '@/lib/identifiers';
import { cn } from '@/lib/utils';

/**
 * Peças comuns dos dois fluxos que mandam um documento para fora — compartilhar e
 * pedir assinatura. Cada fluxo tem a sua regra; o ritmo e a forma são os mesmos:
 * quem recebe → em que condições → o que vai acontecer.
 */

export type RecipientAudience = 'internal' | 'external';

export type InternalCandidate = {
  id: string;
  name: string;
  email: string;
};

export type ExternalRecipientDraft = {
  name: string;
  email: string;
  phone: string;
  organizationName: string;
};

export const EMPTY_EXTERNAL_RECIPIENT: ExternalRecipientDraft = {
  name: '',
  email: '',
  phone: '',
  organizationName: '',
};

/** Data em `yyyy-mm-dd`: o prazo é dia, não hora — o link fecha no fim do dia escolhido. */
export function defaultExpirationDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/** Converte o dia escolhido no instante em que o acesso fecha: 23:59:59 daquele dia. */
export function expirationDateToIso(date: string): string | undefined {
  if (!date) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59, 0).toISOString();
}

/* ── Trilha de passos ─────────────────────────────────────────────────── */

export function StepTrack({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="recipient-steps">
      {steps.map((label, index) => {
        const state = index === current ? 'current' : index < current ? 'done' : 'todo';
        const reachable = onSelect && index < current;
        return (
          <li key={label} className="recipient-steps__item" data-state={state}>
            <button
              type="button"
              className="recipient-steps__button"
              disabled={!reachable}
              onClick={() => reachable && onSelect(index)}
            >
              <span className="recipient-steps__index">{index + 1}</span>
              <span className="recipient-steps__label">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Passo 1 — quem recebe ────────────────────────────────────────────── */

export function AudiencePicker({
  value,
  onChange,
  internalLabel,
  externalLabel,
}: {
  value: RecipientAudience;
  onChange: (value: RecipientAudience) => void;
  internalLabel: string;
  externalLabel: string;
}) {
  return (
    <SegmentedTextToggle
      value={value}
      onChange={onChange}
      options={[
        { value: 'internal' as RecipientAudience, label: internalLabel },
        { value: 'external' as RecipientAudience, label: externalLabel },
      ]}
      aria-label="Tipo de destinatário"
    />
  );
}

export function InternalRecipientPicker({
  query,
  onQueryChange,
  candidates,
  loading,
  selected,
  onSelect,
  emptyLabel,
  emptyAction,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  candidates: InternalCandidate[];
  loading: boolean;
  selected: InternalCandidate | null;
  onSelect: (candidate: InternalCandidate | null) => void;
  emptyLabel: string;
  /**
   * A saída para quem não está na empresa.
   *
   * Sem isto, digitar o e-mail de alguém de fora termina em "Ninguém encontrado" e mais nada — o
   * beco sem saída que existe hoje. O seletor não sabe o que oferecer; quem o usa sabe, e passa.
   */
  emptyAction?: ReactNode;
}) {
  if (selected) {
    return (
      <div className="recipient-chosen">
        <UserAvatar name={selected.name} email={selected.email} size="sm" />
        <div className="min-w-0">
          <p className="type-body truncate text-doqyn-text">{selected.name}</p>
          <p className="type-caption truncate text-doqyn-muted">{selected.email}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        variant="rule"
        label="Buscar pessoa"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Nome ou e-mail"
        autoComplete="off"
      />
      <div className="recipient-candidates">
        {loading ? (
          <p className="type-caption px-1 py-2 text-doqyn-muted">Buscando…</p>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col gap-2 px-1 py-2">
            <p className="type-caption text-doqyn-muted">{emptyLabel}</p>
            {emptyAction}
          </div>
        ) : (
          candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="recipient-candidate"
              onClick={() => onSelect(candidate)}
            >
              <UserAvatar name={candidate.name} email={candidate.email} size="sm" />
              <span className="min-w-0 text-left">
                <span className="type-body block truncate text-doqyn-text">{candidate.name}</span>
                <span className="type-caption block truncate text-doqyn-muted">
                  {candidate.email}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function ExternalRecipientFields({
  value,
  onChange,
  requireName,
  phoneError,
}: {
  value: ExternalRecipientDraft;
  onChange: (value: ExternalRecipientDraft) => void;
  requireName: boolean;
  phoneError?: string;
}) {
  return (
    <div className="recipient-fields">
      <Input
        variant="rule"
        label={requireName ? 'Nome' : 'Nome (opcional)'}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Como a pessoa assina"
        autoComplete="off"
      />
      <Input
        variant="rule"
        type="email"
        label="E-mail"
        value={value.email}
        onChange={(event) => onChange({ ...value, email: event.target.value })}
        placeholder="pessoa@empresa.com.br"
        autoComplete="off"
      />
      <WhatsappInput
        variant="rule"
        label="Telefone (opcional)"
        value={value.phone}
        onChange={(next) => onChange({ ...value, phone: next })}
        placeholder={WHATSAPP_PLACEHOLDER}
        error={phoneError}
      />
      <Input
        variant="rule"
        label="Organização (opcional)"
        value={value.organizationName}
        onChange={(event) => onChange({ ...value, organizationName: event.target.value })}
        placeholder="Empresa da pessoa"
        autoComplete="off"
      />
    </div>
  );
}

/* ── Passo 2 — condições ──────────────────────────────────────────────── */

export function ConditionsStep({
  expiresAt,
  onExpiresAtChange,
  expiresHint,
  toggles,
  message,
  onMessageChange,
  messageLabel = 'Mensagem (opcional)',
  messagePlaceholder,
}: {
  expiresAt: string;
  onExpiresAtChange: (value: string) => void;
  expiresHint?: string;
  toggles?: Array<{
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }>;
  message: string;
  onMessageChange: (value: string) => void;
  messageLabel?: string;
  messagePlaceholder?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <DateField
          variant="rule"
          label="Válido até"
          value={expiresAt}
          onChange={onExpiresAtChange}
          placeholder="Escolher data"
        />
        {expiresHint ? <p className="type-caption text-doqyn-subtle">{expiresHint}</p> : null}
      </div>

      {toggles?.length ? (
        <div className="flex flex-col gap-3">
          {toggles.map((toggle) => (
            <Checkbox
              key={toggle.id}
              checked={toggle.checked}
              onChange={(event) => toggle.onChange(event.target.checked)}
              label={toggle.label}
              description={toggle.description}
            />
          ))}
        </div>
      ) : null}

      <Textarea
        variant="rule"
        label={messageLabel}
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        placeholder={messagePlaceholder}
        rows={3}
      />
    </div>
  );
}

/* ── Passo 3 — resumo ─────────────────────────────────────────────────── */

export function SummaryStep({
  rows,
  note,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="recipient-summary">
        {rows.map((row) => (
          <div key={row.label} className="recipient-summary__row">
            <dt className="register-label text-doqyn-subtle">{row.label}</dt>
            <dd className="type-body min-w-0 break-words text-doqyn-text">{row.value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="type-caption text-doqyn-muted">{note}</p> : null}
    </div>
  );
}

/* ── Lista de quem já tem acesso ──────────────────────────────────────── */

export type AccessRowAction = {
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
};

export function AccessList({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: Array<{
    id: string;
    primary: string;
    secondary?: ReactNode;
    status: { label: string; tone: 'active' | 'pending' | 'closed' };
    actions: AccessRowAction[];
  }>;
}) {
  return (
    <section className="recipient-access">
      <p className="register-label text-doqyn-subtle">{title}</p>
      {rows.length === 0 ? (
        <p className="type-caption text-doqyn-muted">{emptyLabel}</p>
      ) : (
        <ul className="recipient-access__list">
          {rows.map((row) => (
            <li key={row.id} className="recipient-access__row">
              <div className="min-w-0">
                <p className="type-body truncate text-doqyn-text">{row.primary}</p>
                {row.secondary ? (
                  <p className="type-caption text-doqyn-muted">{row.secondary}</p>
                ) : null}
              </div>
              <span className="recipient-access__status" data-tone={row.status.tone}>
                {row.status.label}
              </span>
              <div className="recipient-access__actions">
                {row.actions.map((action) => (
                  <Button
                    key={action.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className={
                      action.tone === 'danger'
                        ? 'text-doqyn-danger hover:text-doqyn-danger'
                        : undefined
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Link emitido ─────────────────────────────────────────────────────── */

export function IssuedLink({ url, label = 'Link do convidado' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="recipient-link">
      <p className="register-label text-doqyn-subtle">{label}</p>
      <div className="recipient-link__row">
        <code className="recipient-link__value">{url}</code>
        <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopy()}>
          <Icon name={copied ? 'check' : 'content_copy'} size={ICON_SIZE.xs} aria-hidden />
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
}

/* ── Rodapé em passos ─────────────────────────────────────────────────── */

export function FlowFooter({
  step,
  stepCount,
  canAdvance,
  submitting,
  submitLabel,
  onBack,
  onNext,
  onSubmit,
  onCancel,
}: {
  step: number;
  stepCount: number;
  canAdvance: boolean;
  submitting: boolean;
  submitLabel: string;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const isLast = step === stepCount - 1;
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={step === 0 ? onCancel : onBack}>
        {step === 0 ? 'Cancelar' : 'Voltar'}
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={!canAdvance || submitting}
        onClick={isLast ? onSubmit : onNext}
      >
        {isLast ? (submitting ? 'Enviando…' : submitLabel) : 'Continuar'}
      </Button>
    </>
  );
}

export function useStepFlow(stepCount: number, open: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  return useMemo(
    () => ({
      step,
      setStep,
      next: () => setStep((current) => Math.min(current + 1, stepCount - 1)),
      back: () => setStep((current) => Math.max(current - 1, 0)),
      reset: () => setStep(0),
    }),
    [step, stepCount],
  );
}

export function statusTone(status: string): 'active' | 'pending' | 'closed' {
  if (status === 'active' || status === 'signed') return 'active';
  if (status === 'pending' || status === 'partially_signed') return 'pending';
  return 'closed';
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Data em `yyyy-mm-dd` para leitura humana, sem passar por fuso. */
export function formatExpirationDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}

export function cnJoin(...values: Array<string | false | null | undefined>): string {
  return cn(...values);
}
