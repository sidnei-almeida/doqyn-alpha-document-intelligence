import { DateInput } from '@/components/ui/DateInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { AuditEventFilters, AuditSeverity } from '@/types/audit';
import { AUDIT_SEVERITY_LABELS } from '@/types/audit';

type AuditFiltersProps = {
  filters: AuditEventFilters;
  onChange: (filters: AuditEventFilters) => void;
};

const severityOptions: Array<{ value: AuditSeverity | ''; label: string }> = [
  { value: '', label: 'Todas severidades' },
  ...Object.entries(AUDIT_SEVERITY_LABELS).map(([value, label]) => ({
    value: value as AuditSeverity,
    label,
  })),
];

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Input
        id="audit-search"
        label="Buscar"
        placeholder="Ação, usuário, documento..."
        value={filters.q ?? ''}
        onChange={(event) => onChange({ ...filters, q: event.target.value })}
      />
      <Input
        id="audit-type"
        label="Tipo de evento"
        placeholder="Ex.: document.created"
        value={filters.type ?? ''}
        onChange={(event) => onChange({ ...filters, type: event.target.value })}
      />
      <Select
        id="audit-severity"
        label="Severidade"
        value={filters.severity ?? ''}
        onChange={(event) =>
          onChange({ ...filters, severity: event.target.value as AuditSeverity | '' })
        }
        options={severityOptions}
      />
      <DateInput
        id="audit-from"
        label="De"
        value={filters.from ?? ''}
        onChange={(event) => onChange({ ...filters, from: event.target.value })}
      />
      <DateInput
        id="audit-to"
        label="Até"
        value={filters.to ?? ''}
        onChange={(event) => onChange({ ...filters, to: event.target.value })}
      />
    </div>
  );
}
