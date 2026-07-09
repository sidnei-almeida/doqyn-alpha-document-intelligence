import { FilterBar, FilterBarField } from '@/components/ui/FilterBar';
import { DateInput } from '@/components/ui/DateInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { DocumentTrackingFilters } from '@/types/document-tracking';
import {
  TRACKING_ACTION_GROUP_OPTIONS,
  TRACKING_CATEGORY_OPTIONS,
  TRACKING_SEVERITY_OPTIONS,
  TRACKING_STATUS_OPTIONS,
} from '../utils/trackingDisplay';

type TrackingFiltersProps = {
  filters: DocumentTrackingFilters;
  onChange: (filters: DocumentTrackingFilters) => void;
  onClear?: () => void;
  showClear?: boolean;
  summary?: string;
};

export function TrackingFilters({
  filters,
  onChange,
  onClear,
  showClear = false,
  summary,
}: TrackingFiltersProps) {
  return (
    <FilterBar onClear={onClear} showClear={showClear} summary={summary}>
      <FilterBarField span={2}>
        <Input
          id="tracking-search"
          label="Buscar"
          placeholder="Documento, usuário, ação..."
          value={filters.q ?? ''}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          id="tracking-document"
          label="Documento"
          placeholder="ID do documento"
          value={filters.documentId ?? ''}
          onChange={(event) => onChange({ ...filters, documentId: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
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
      </FilterBarField>
      <FilterBarField>
        <Select
          id="tracking-action-group"
          label="Grupo"
          value={filters.actionGroup ?? ''}
          onChange={(event) => onChange({ ...filters, actionGroup: event.target.value })}
          options={TRACKING_ACTION_GROUP_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </FilterBarField>
      <FilterBarField>
        <Select
          id="tracking-status"
          label="Resultado"
          value={filters.status ?? ''}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
          options={TRACKING_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </FilterBarField>
      <FilterBarField>
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
      </FilterBarField>
      <FilterBarField>
        <DateInput
          id="tracking-from"
          label="De"
          value={filters.from ?? ''}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <DateInput
          id="tracking-to"
          label="Até"
          value={filters.to ?? ''}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          id="tracking-action"
          label="Ação"
          placeholder="document.downloaded"
          value={filters.action ?? ''}
          onChange={(event) => onChange({ ...filters, action: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          id="tracking-request-id"
          label="Request ID"
          placeholder="req_..."
          value={filters.requestId ?? ''}
          onChange={(event) => onChange({ ...filters, requestId: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          id="tracking-actor"
          label="Usuário (ID)"
          placeholder="userId"
          value={filters.actorUserId ?? ''}
          onChange={(event) => onChange({ ...filters, actorUserId: event.target.value })}
        />
      </FilterBarField>
    </FilterBar>
  );
}
