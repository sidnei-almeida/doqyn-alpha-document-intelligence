import type { DashboardOverviewResponse, DashboardPeriodKey } from '@/types/dashboard-overview';

export type OverviewMetric = {
  key: string;
  label: string;
  value: number;
  subtext: string;
  path: string;
  tone?: 'default' | 'attention' | 'danger';
};

export function buildOverviewMetrics(
  data: DashboardOverviewResponse,
  period: DashboardPeriodKey,
): OverviewMetric[] {
  const { summary } = data;
  const periodDays = period === '7d' ? '7' : period === '90d' ? '90' : '30';

  return [
    {
      key: 'documents',
      label: 'Documentos',
      value: summary.totalDocuments,
      subtext: `+${summary.documentsUploadedInPeriod} nos últimos ${periodDays} dias`,
      path: '/biblioteca',
    },
    {
      key: 'analysis',
      label: 'Em análise',
      value: summary.documentsInAnalysis,
      subtext: 'processamento em andamento',
      path: '/biblioteca?status=analyzing',
      tone: summary.documentsInAnalysis > 0 ? 'attention' : 'default',
    },
    {
      key: 'review',
      label: 'Aguardando revisão',
      value: summary.documentsAwaitingReview,
      subtext: 'confirmação manual',
      path: '/biblioteca?status=pending_review',
      tone: summary.documentsAwaitingReview > 0 ? 'attention' : 'default',
    },
    {
      key: 'processed',
      label: 'Processados',
      value: summary.documentsProcessed,
      subtext: `${summary.previewReady} previews prontos`,
      path: '/biblioteca?status=processed',
    },
    {
      key: 'errors',
      label: 'Erros',
      value: summary.documentsWithErrors,
      subtext: 'preview ou análise',
      path: '/audit',
      tone: summary.documentsWithErrors > 0 ? 'danger' : 'default',
    },
    {
      key: 'events',
      label: 'Eventos',
      value: summary.trackingEventsInPeriod,
      subtext: `${summary.viewsInPeriod} previews · ${summary.downloadsInPeriod} downloads`,
      path: '/tracking',
    },
  ];
}

export function formatStorageBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
