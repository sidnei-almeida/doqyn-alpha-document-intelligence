import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DocumentTrackingFilters, DocumentTrackingListItem } from '@/types/document-tracking';
import { getDocumentTrackingEvent, listDocumentTrackingEvents } from '../api/trackingApi';

export function useDocumentTracking(initialDocumentId?: string) {
  const [searchParams] = useSearchParams();
  const documentIdFromUrl = searchParams.get('documentId') ?? undefined;

  const [filters, setFilters] = useState<DocumentTrackingFilters>({
    documentId: initialDocumentId ?? documentIdFromUrl,
    category: 'all',
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const eventsQuery = useInfiniteQuery({
    queryKey: ['document-tracking', filters],
    queryFn: ({ pageParam }) => listDocumentTrackingEvents(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
  });

  const items = useMemo(
    () => eventsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [eventsQuery.data?.pages],
  );

  const detailQuery = useQuery({
    queryKey: ['document-tracking-detail', selectedEventId],
    queryFn: () => getDocumentTrackingEvent(selectedEventId!),
    enabled: Boolean(selectedEventId),
  });

  const openEvent = (event: DocumentTrackingListItem) => setSelectedEventId(event.id);
  const closeEvent = () => setSelectedEventId(null);

  return {
    filters,
    setFilters,
    items,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    isFetchingMore: eventsQuery.isFetchingNextPage,
    hasMore: Boolean(eventsQuery.hasNextPage),
    loadMore: () => eventsQuery.fetchNextPage(),
    selectedEventId,
    selectedEvent: detailQuery.data?.event ?? null,
    detailLoading: detailQuery.isLoading,
    openEvent,
    closeEvent,
  };
}
