import { useQuery } from '@tanstack/react-query';
import type { DocumentTrackingFilters } from '@/types/document-tracking';
import { fetchTrackingSummary } from '../api/trackingApi';

export function useTrackingSummary(filters: Pick<DocumentTrackingFilters, 'from' | 'to'> = {}) {
  return useQuery({
    queryKey: ['tracking-summary', filters.from ?? '', filters.to ?? ''],
    queryFn: () => fetchTrackingSummary(filters),
    staleTime: 30_000,
  });
}
