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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('tracking');

  return (
    <FilterBar onClear={onClear} showClear={showClear} summary={summary}>
      <FilterBarField span={2}>
        <Input
          variant="rule"
          id="tracking-search"
          label={t('trackingFilters.buscar')}
          placeholder={t('trackingFilters.documentoUsuarioAcao')}
          value={filters.q ?? ''}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          variant="rule"
          id="tracking-document"
          label={t('trackingFilters.documento')}
          placeholder={t('trackingFilters.idDoDocumento')}
          value={filters.documentId ?? ''}
          onChange={(event) => onChange({ ...filters, documentId: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Select
          variant="rule"
          id="tracking-category"
          label={t('trackingFilters.categoria')}
          value={filters.category ?? 'all'}
          onChange={(event) => onChange({ ...filters, category: event.target.value })}
          options={TRACKING_CATEGORY_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
      </FilterBarField>
      <FilterBarField>
        <Select
          variant="rule"
          id="tracking-action-group"
          label={t('trackingFilters.grupo')}
          value={filters.actionGroup ?? ''}
          onChange={(event) => onChange({ ...filters, actionGroup: event.target.value })}
          options={TRACKING_ACTION_GROUP_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
      </FilterBarField>
      <FilterBarField>
        <Select
          variant="rule"
          id="tracking-status"
          label={t('trackingFilters.resultado')}
          value={filters.status ?? ''}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
          options={TRACKING_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
      </FilterBarField>
      <FilterBarField>
        <Select
          variant="rule"
          id="tracking-severity"
          label={t('trackingFilters.severidade')}
          value={filters.severity ?? ''}
          onChange={(event) => onChange({ ...filters, severity: event.target.value })}
          options={TRACKING_SEVERITY_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />
      </FilterBarField>
      <FilterBarField>
        <DateInput
          variant="rule"
          id="tracking-from"
          label={t('trackingFilters.de')}
          value={filters.from ?? ''}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <DateInput
          variant="rule"
          id="tracking-to"
          label={t('trackingFilters.ate')}
          value={filters.to ?? ''}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          variant="rule"
          id="tracking-action"
          label={t('trackingFilters.acao')}
          placeholder="document.downloaded"
          value={filters.action ?? ''}
          onChange={(event) => onChange({ ...filters, action: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          variant="rule"
          id="tracking-request-id"
          label={t('trackingFilters.requestId')}
          placeholder="req_..."
          value={filters.requestId ?? ''}
          onChange={(event) => onChange({ ...filters, requestId: event.target.value })}
        />
      </FilterBarField>
      <FilterBarField>
        <Input
          variant="rule"
          id="tracking-actor"
          label={t('trackingFilters.usuarioId')}
          placeholder="userId"
          value={filters.actorUserId ?? ''}
          onChange={(event) => onChange({ ...filters, actorUserId: event.target.value })}
        />
      </FilterBarField>
    </FilterBar>
  );
}
