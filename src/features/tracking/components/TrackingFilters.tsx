import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { DocumentTrackingFilters } from '@/types/document-tracking';
import { TRACKING_CATEGORY_OPTIONS, TRACKING_SEVERITY_OPTIONS } from '../utils/trackingDisplay';

type TrackingFiltersProps = {
  filters: DocumentTrackingFilters;
  onChange: (filters: DocumentTrackingFilters) => void;
};

export function TrackingFilters({ filters, onChange }: TrackingFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Input
        id="tracking-search"
        label="Buscar"
        placeholder="Documento, usuário, ação..."
        value={filters.q ?? ''}
        onChange={(event) => onChange({ ...filters, q: event.target.value })}
      />
      <Input
        id="tracking-document"
        label="Documento"
        placeholder="ID do documento"
        value={filters.documentId ?? ''}
        onChange={(event) => onChange({ ...filters, documentId: event.target.value })}
      />
      <Select
        id="tracking-category"
        label="Categoria"
        value={filters.category ?? 'all'}
        onChange={(event) => onChange({ ...filters, category: event.target.value })}
        options={TRACKING_CATEGORY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <Select
        id="tracking-severity"
        label="Severidade"
        value={filters.severity ?? ''}
        onChange={(event) => onChange({ ...filters, severity: event.target.value })}
        options={TRACKING_SEVERITY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <Input
        id="tracking-from"
        label="De"
        type="date"
        value={filters.from ?? ''}
        onChange={(event) => onChange({ ...filters, from: event.target.value })}
      />
      <Input
        id="tracking-to"
        label="Até"
        type="date"
        value={filters.to ?? ''}
        onChange={(event) => onChange({ ...filters, to: event.target.value })}
      />
      <Input
        id="tracking-action"
        label="Ação"
        placeholder="document.downloaded"
        value={filters.action ?? ''}
        onChange={(event) => onChange({ ...filters, action: event.target.value })}
      />
      <Input
        id="tracking-actor"
        label="Usuário (ID)"
        placeholder="userId"
        value={filters.actorUserId ?? ''}
        onChange={(event) => onChange({ ...filters, actorUserId: event.target.value })}
      />
    </div>
  );
}
