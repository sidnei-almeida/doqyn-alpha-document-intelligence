type PhaseAMetricsSnapshot = {
  analysis_queue_waiting: number;
  analysis_queue_active: number;
  analysis_queue_depth: number;
  quota_exceeded_total: number;
};

let quotaExceededTotal = 0;
let lastQueueWaiting = 0;
let lastQueueActive = 0;

export function recordQuotaExceeded(): void {
  quotaExceededTotal += 1;
}

export function updateAnalysisQueueDepth(waiting: number, active: number): void {
  lastQueueWaiting = waiting;
  lastQueueActive = active;
}

export function getPhaseAMetricsSnapshot(): PhaseAMetricsSnapshot {
  return {
    analysis_queue_waiting: lastQueueWaiting,
    analysis_queue_active: lastQueueActive,
    analysis_queue_depth: lastQueueWaiting + lastQueueActive,
    quota_exceeded_total: quotaExceededTotal,
  };
}
