import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

const SERVICE_NAME = process.env.METRICS_SERVICE_NAME?.trim() || 'doqyn-api';
const SERVICE_ROLE = process.env.METRICS_SERVICE_ROLE?.trim() || 'api';

export const prometheusRegistry = new Registry();

prometheusRegistry.setDefaultLabels({
  service: SERVICE_NAME,
  role: SERVICE_ROLE,
});

let defaultMetricsStarted = false;

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function isPrometheusEnabled(): boolean {
  return readBool(process.env.METRICS_ENABLED, process.env.NODE_ENV === 'production');
}

export function initPrometheusMetrics(): void {
  if (!isPrometheusEnabled() || defaultMetricsStarted) return;

  collectDefaultMetrics({
    register: prometheusRegistry,
    prefix: 'doqyn_',
  });
  defaultMetricsStarted = true;
}

export const httpRequestsTotal = new Counter({
  name: 'doqyn_http_requests_total',
  help: 'Total de requisições HTTP na API',
  labelNames: ['method', 'route', 'status_class'] as const,
  registers: [prometheusRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'doqyn_http_request_duration_seconds',
  help: 'Duração das requisições HTTP',
  labelNames: ['method', 'route'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [prometheusRegistry],
});

export const sessionVerifyTotal = new Counter({
  name: 'doqyn_session_verify_total',
  help: 'Verificações de sessão auth (cache hit/miss)',
  labelNames: ['result'] as const,
  registers: [prometheusRegistry],
});

export const analysisQueueWaitingGauge = new Gauge({
  name: 'doqyn_analysis_queue_waiting',
  help: 'Jobs de análise aguardando na fila BullMQ',
  registers: [prometheusRegistry],
});

export const analysisQueueActiveGauge = new Gauge({
  name: 'doqyn_analysis_queue_active',
  help: 'Jobs de análise em processamento na fila BullMQ',
  registers: [prometheusRegistry],
});

export const previewQueueWaitingGauge = new Gauge({
  name: 'doqyn_preview_queue_waiting',
  help: 'Jobs de preview aguardando na fila BullMQ',
  registers: [prometheusRegistry],
});

export const previewQueueActiveGauge = new Gauge({
  name: 'doqyn_preview_queue_active',
  help: 'Jobs de preview em processamento na fila BullMQ',
  registers: [prometheusRegistry],
});

export const previewJobsTotal = new Counter({
  name: 'doqyn_preview_jobs_total',
  help: 'Jobs de preview por resultado',
  labelNames: ['status'] as const,
  registers: [prometheusRegistry],
});

export const previewJobDurationSeconds = new Histogram({
  name: 'doqyn_preview_job_duration_seconds',
  help: 'Duração do processamento de jobs de preview no worker',
  labelNames: ['status'] as const,
  buckets: [1, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300],
  registers: [prometheusRegistry],
});

export const analysisJobsTotal = new Counter({
  name: 'doqyn_analysis_jobs_total',
  help: 'Jobs de análise por resultado',
  labelNames: ['job_kind', 'status'] as const,
  registers: [prometheusRegistry],
});

export const analysisJobDurationSeconds = new Histogram({
  name: 'doqyn_analysis_job_duration_seconds',
  help: 'Duração do processamento de jobs de análise no worker',
  labelNames: ['job_kind', 'status'] as const,
  buckets: [1, 5, 10, 20, 30, 45, 60, 90, 120, 180, 300],
  registers: [prometheusRegistry],
});

export const analysisSaturationRequeuesTotal = new Counter({
  name: 'doqyn_analysis_saturation_requeues_total',
  help: 'Jobs de análise devolvidos à fila por saturação da vazão da Groq',
  labelNames: ['job_kind'] as const,
  registers: [prometheusRegistry],
});

export const aiProviderRequestsTotal = new Counter({
  name: 'doqyn_ai_provider_requests_total',
  help: 'Chamadas ao provedor de IA',
  labelNames: ['provider', 'operation', 'status'] as const,
  registers: [prometheusRegistry],
});

export const aiProviderLatencySeconds = new Histogram({
  name: 'doqyn_ai_provider_latency_seconds',
  help: 'Latência das chamadas ao provedor de IA',
  labelNames: ['provider', 'operation'] as const,
  buckets: [0.25, 0.5, 1, 2, 5, 10, 15, 25, 40, 60],
  registers: [prometheusRegistry],
});

export const quotaExceededTotal = new Counter({
  name: 'doqyn_quota_exceeded_total',
  help: 'Total de rejeições por quota de tenant excedida',
  labelNames: ['action'] as const,
  registers: [prometheusRegistry],
});

export const visionOcrRequestsTotal = new Counter({
  name: 'doqyn_vision_ocr_requests_total',
  help: 'Chamadas ao Vision OCR (fallback de texto)',
  labelNames: ['status'] as const,
  registers: [prometheusRegistry],
});

export const visionOcrPagesTotal = new Counter({
  name: 'doqyn_vision_ocr_pages_total',
  help: 'Páginas processadas pelo Vision OCR',
  registers: [prometheusRegistry],
});

export const visionOcrFailuresTotal = new Counter({
  name: 'doqyn_vision_ocr_failures_total',
  help: 'Falhas no Vision OCR',
  labelNames: ['reason'] as const,
  registers: [prometheusRegistry],
});

function statusClass(statusCode: number): string {
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (statusCode >= 300) return '3xx';
  if (statusCode >= 200) return '2xx';
  return 'other';
}

export function recordHttpRequest(input: {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}): void {
  if (!isPrometheusEnabled()) return;

  const method = input.method.toUpperCase();
  const status_class = statusClass(input.statusCode);

  httpRequestsTotal.inc({ method, route: input.route, status_class });
  httpRequestDurationSeconds.observe({ method, route: input.route }, input.durationSeconds);
}

export function recordSessionVerify(result: 'cache_hit' | 'cache_miss'): void {
  if (!isPrometheusEnabled()) return;
  sessionVerifyTotal.inc({ result });
}

export function updateAnalysisQueueDepthMetrics(waiting: number, active: number): void {
  if (!isPrometheusEnabled()) return;
  analysisQueueWaitingGauge.set(waiting);
  analysisQueueActiveGauge.set(active);
}

export function recordQuotaExceededMetric(action: string): void {
  if (!isPrometheusEnabled()) return;
  quotaExceededTotal.inc({ action });
}

export function updatePreviewQueueDepthMetrics(waiting: number, active: number): void {
  if (!isPrometheusEnabled()) return;
  previewQueueWaitingGauge.set(waiting);
  previewQueueActiveGauge.set(active);
}

export function recordPreviewJobCompletion(input: {
  status: string;
  durationSeconds: number;
}): void {
  if (!isPrometheusEnabled()) return;

  const labels = { status: input.status };
  previewJobsTotal.inc(labels);
  previewJobDurationSeconds.observe(labels, input.durationSeconds);
}

export function recordAnalysisJobCompletion(input: {
  jobKind: string;
  status: string;
  durationSeconds: number;
}): void {
  if (!isPrometheusEnabled()) return;

  const labels = { job_kind: input.jobKind, status: input.status };
  analysisJobsTotal.inc(labels);
  analysisJobDurationSeconds.observe(labels, input.durationSeconds);
}

export function recordAnalysisSaturationRequeue(input: { jobKind: string }): void {
  if (!isPrometheusEnabled()) return;

  analysisSaturationRequeuesTotal.inc({ job_kind: input.jobKind });
}

export function recordAiProviderRequest(input: {
  provider: string;
  operation: string;
  status: 'success' | 'error' | 'rate_limit';
  durationSeconds: number;
}): void {
  if (!isPrometheusEnabled()) return;

  aiProviderRequestsTotal.inc({
    provider: input.provider,
    operation: input.operation,
    status: input.status,
  });
  aiProviderLatencySeconds.observe(
    { provider: input.provider, operation: input.operation },
    input.durationSeconds,
  );
}

export function recordVisionOcrRequest(input: {
  status: 'success' | 'error' | 'skipped';
  pagesProcessed?: number;
  failureReason?: string;
}): void {
  if (!isPrometheusEnabled()) return;

  visionOcrRequestsTotal.inc({ status: input.status });

  if (input.status === 'success' && input.pagesProcessed && input.pagesProcessed > 0) {
    visionOcrPagesTotal.inc(input.pagesProcessed);
  }

  if (input.status === 'error') {
    visionOcrFailuresTotal.inc({
      reason: input.failureReason?.trim() || 'unknown',
    });
  }
}

export async function renderPrometheusMetrics(): Promise<string> {
  initPrometheusMetrics();
  await refreshQueueDepthGauges();
  return prometheusRegistry.metrics();
}

async function refreshQueueDepthGauges(): Promise<void> {
  try {
    const { getAnalysisQueueStats } = await import('../queues/analysisQueue.js');
    const { getPreviewQueueStats } = await import('../queues/previewQueue.js');
    await Promise.all([getAnalysisQueueStats(), getPreviewQueueStats()]);
  } catch {
    // Redis/fila indisponível — mantém último valor conhecido.
  }
}

export function getPrometheusContentType(): string {
  return prometheusRegistry.contentType;
}

export function configurePrometheusService(input: {
  serviceName?: string;
  serviceRole?: 'api' | 'worker' | 'worker-preview' | string;
}): void {
  if (input.serviceName) {
    prometheusRegistry.setDefaultLabels({
      service: input.serviceName,
      role: input.serviceRole ?? SERVICE_ROLE,
    });
  } else if (input.serviceRole) {
    prometheusRegistry.setDefaultLabels({
      service: SERVICE_NAME,
      role: input.serviceRole,
    });
  }
}
