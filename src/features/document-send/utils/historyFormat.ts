import { formatDate, formatTime } from '@/lib/formatLocale';

export function formatHistoryDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const datePart = formatDate(value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = formatTime(value, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
}

export function formatFileSizeLabel(bytes?: number): string {
  if (bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
