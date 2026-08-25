import type { DashboardOverviewResponse, DashboardPeriodKey } from '@/types/dashboard-overview';

export type OverviewMetric = {
  key: string;
  label: string;
  value: number;
  subtext: string;
  path: string;
  tone?: 'default' | 'attention' | 'danger';
};

/** "1 downloads" aparecia no painel — o subtexto conta, então concorda. */
function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

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
      subtext: `${plural(summary.previewReady, 'preview')} ${summary.previewReady === 1 ? 'pronto' : 'prontos'}`,
      path: '/biblioteca?status=processed',
    },
    {
      key: 'errors',
      label: 'Erros',
      value: summary.documentsWithErrors,
      // "preview ou análise" descrevia a origem do erro, não o que o número
      // conta — e o número conta documentos, não incidentes.
      subtext: summary.documentsWithErrors === 1 ? 'documento afetado' : 'documentos afetados',
      path: '/audit',
      tone: summary.documentsWithErrors > 0 ? 'danger' : 'default',
    },
    {
      key: 'events',
      label: 'Eventos',
      value: summary.trackingEventsInPeriod,
      subtext: `${plural(summary.viewsInPeriod, 'preview')} · ${plural(summary.downloadsInPeriod, 'download')}`,
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
