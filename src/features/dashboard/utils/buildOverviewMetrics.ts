import type { TFunction } from 'i18next';
import { formatNumber } from '@/i18n/formats';
import type { DashboardOverviewResponse, DashboardPeriodKey } from '@/types/dashboard-overview';

export type OverviewMetric = {
  key: string;
  label: string;
  value: number;
  subtext: string;
  path: string;
  tone?: 'default' | 'attention' | 'danger';
};

/**
 * As métricas do painel: rótulo e subtexto vêm do catálogo, o número vem do servidor.
 *
 * A função recebe o `t` porque roda dentro de um `useMemo` da tela — sem ele nas dependências, o
 * painel ficaria no idioma anterior depois de trocar.
 *
 * O plural saiu do código junto. Havia dois jeitos aqui, ambos presos ao português: um helper
 * que colava um `s` no fim (`${count} preview${count === 1 ? '' : 's'}`) e um ternário escolhendo
 * entre "pronto" e "prontos". Nenhum dos dois sobrevive a um idioma com mais de duas categorias
 * de plural, e o `s` colado nem ao inglês. Agora são frases inteiras no catálogo, com sufixo
 * `_one`/`_other`, e quem escolhe é o `Intl.PluralRules`.
 */
export function buildOverviewMetrics(
  data: DashboardOverviewResponse,
  period: DashboardPeriodKey,
  t: TFunction,
): OverviewMetric[] {
  const { summary } = data;
  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;

  return [
    {
      key: 'documents',
      label: t('dashboard:metric.documentsLabel'),
      value: summary.totalDocuments,
      subtext: t('dashboard:metric.documentsSubtext', {
        count: summary.documentsUploadedInPeriod,
        days: periodDays,
      }),
      path: '/biblioteca',
    },
    {
      key: 'analysis',
      label: t('dashboard:metric.analysisLabel'),
      value: summary.documentsInAnalysis,
      subtext: t('dashboard:metric.analysisSubtext'),
      path: '/biblioteca?status=analyzing',
      tone: summary.documentsInAnalysis > 0 ? 'attention' : 'default',
    },
    {
      key: 'review',
      label: t('dashboard:metric.reviewLabel'),
      value: summary.documentsAwaitingReview,
      subtext: t('dashboard:metric.reviewSubtext'),
      path: '/biblioteca?status=pending_review',
      tone: summary.documentsAwaitingReview > 0 ? 'attention' : 'default',
    },
    {
      key: 'processed',
      label: t('dashboard:metric.processedLabel'),
      value: summary.documentsProcessed,
      subtext: t('dashboard:metric.processedSubtext', { count: summary.previewReady }),
      path: '/biblioteca?status=processed',
    },
    {
      key: 'errors',
      label: t('dashboard:metric.errorsLabel'),
      value: summary.documentsWithErrors,
      // "preview ou análise" descrevia a origem do erro, não o que o número
      // conta — e o número conta documentos, não incidentes.
      subtext: t('dashboard:metric.errorsSubtext', { count: summary.documentsWithErrors }),
      path: '/audit',
      tone: summary.documentsWithErrors > 0 ? 'danger' : 'default',
    },
    {
      key: 'events',
      label: t('dashboard:metric.eventsLabel'),
      value: summary.trackingEventsInPeriod,
      subtext: t('dashboard:metric.eventsSubtext', {
        views: t('dashboard:metric.previewCount', { count: summary.viewsInPeriod }),
        downloads: t('dashboard:metric.downloadCount', { count: summary.downloadsInPeriod }),
      }),
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
  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unit]}`;
}
