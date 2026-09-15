import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { Select } from '@/components/ui/Select';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { AuditEventFilters, AuditSeverity } from '@/types/audit';
import { AUDIT_SEVERITY_LABEL_KEYS } from '@/types/audit';
import { useTranslation } from 'react-i18next';

export type AuditFiltersMode = 'full' | 'security' | 'overview';

type AuditFiltersProps = {
  filters: AuditEventFilters;
  onChange: (filters: AuditEventFilters) => void;
  mode?: AuditFiltersMode;
};

/**
 * Ajuste de vista, não formulário: cada campo é uma régua com o rótulo de
 * registro em cima. Eram cinco caixas de canto arredondado enfileiradas, o
 * mesmo peso visual de um formulário de cadastro para uma escolha que só filtra
 * uma lista.
 */
function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="register-label text-doqyn-subtle">
        {label}
      </label>
      <div className="field-rule">{children}</div>
    </div>
  );
}

export function AuditFilters({ filters, onChange, mode = 'full' }: AuditFiltersProps) {
  const { t } = useTranslation('audit');

  const showEventType = mode === 'full';
  const showSeverity = mode === 'full' || mode === 'security';
  const severityOptions: Array<{ value: AuditSeverity | ''; label: string }> = [
    { value: '', label: t('auditFilters.allSeverities') },
    ...(Object.keys(AUDIT_SEVERITY_LABEL_KEYS) as AuditSeverity[]).map((value) => ({
      value,
      label: t(AUDIT_SEVERITY_LABEL_KEYS[value]),
    })),
  ];

  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
      <FilterField id="audit-search" label={t('auditFilters.buscar')}>
        <Icon name="search" size={ICON_SIZE.xs} className="shrink-0 text-doqyn-subtle" />
        <input
          id="audit-search"
          type="search"
          placeholder={t('auditFilters.acaoUsuarioDocumento')}
          className="text-label placeholder:text-doqyn-subtle"
          value={filters.q ?? ''}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </FilterField>

      {showEventType && (
        <FilterField id="audit-type" label={t('auditFilters.tipoDeEvento')}>
          <input
            id="audit-type"
            type="text"
            placeholder={t('auditFilters.exDocumentCreated')}
            className="font-mono text-caption placeholder:text-doqyn-subtle"
            value={filters.type ?? ''}
            onChange={(event) => onChange({ ...filters, type: event.target.value })}
          />
        </FilterField>
      )}

      {showSeverity && (
        <Select
          id="audit-severity"
          variant="rule"
          label={t('auditFilters.severidade')}
          value={filters.severity ?? ''}
          options={severityOptions.map((option) => ({ ...option, value: option.value }))}
          onChange={(event) =>
            onChange({ ...filters, severity: event.target.value as AuditSeverity | '' })
          }
        />
      )}

      <DateField
        id="audit-from"
        variant="rule"
        label={t('auditFilters.de')}
        placeholder={t('auditFilters.inicio')}
        value={filters.from ?? ''}
        max={filters.to || undefined}
        onChange={(isoDate) => onChange({ ...filters, from: isoDate })}
      />

      <DateField
        id="audit-to"
        variant="rule"
        label={t('auditFilters.ate')}
        placeholder={t('auditFilters.fim')}
        value={filters.to ?? ''}
        min={filters.from || undefined}
        onChange={(isoDate) => onChange({ ...filters, to: isoDate })}
      />
    </div>
  );
}
