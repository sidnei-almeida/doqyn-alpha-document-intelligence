import {
  getPrometheusContentType,
  isPrometheusEnabled,
  recordQuotaExceededMetric,
  renderPrometheusMetrics,
  updateAnalysisQueueDepthMetrics,
  updatePreviewQueueDepthMetrics,
} from './prometheus.js';

type PhaseAMetricsSnapshot = {
  analysis_queue_waiting: number;
  analysis_queue_active: number;
  analysis_queue_depth: number;
  preview_queue_waiting: number;
  preview_queue_active: number;
  preview_queue_depth: number;
  quota_exceeded_total: number;
  prometheus_enabled: boolean;
};

let lastQueueWaiting = 0;
let lastQueueActive = 0;
let lastPreviewQueueWaiting = 0;
let lastPreviewQueueActive = 0;
let quotaExceededInMemory = 0;

export function recordQuotaExceeded(action = 'unknown'): void {
  quotaExceededInMemory += 1;
  recordQuotaExceededMetric(action);
}

export function updateAnalysisQueueDepth(waiting: number, active: number): void {
  lastQueueWaiting = waiting;
  lastQueueActive = active;
  updateAnalysisQueueDepthMetrics(waiting, active);
}

export function updatePreviewQueueDepth(waiting: number, active: number): void {
  lastPreviewQueueWaiting = waiting;
  lastPreviewQueueActive = active;
  updatePreviewQueueDepthMetrics(waiting, active);
}

export function getPhaseAMetricsSnapshot(): PhaseAMetricsSnapshot {
  return {
    analysis_queue_waiting: lastQueueWaiting,
    analysis_queue_active: lastQueueActive,
    analysis_queue_depth: lastQueueWaiting + lastQueueActive,
    preview_queue_waiting: lastPreviewQueueWaiting,
    preview_queue_active: lastPreviewQueueActive,
    preview_queue_depth: lastPreviewQueueWaiting + lastPreviewQueueActive,
    quota_exceeded_total: quotaExceededInMemory,
    prometheus_enabled: isPrometheusEnabled(),
  };
}

export async function getPrometheusMetricsBody(): Promise<string> {
  return renderPrometheusMetrics();
}

export { getPrometheusContentType, isPrometheusEnabled };
