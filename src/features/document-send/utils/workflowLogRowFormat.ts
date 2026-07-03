import { formatDurationMs } from './workflowLogHelpers';

const DEBUG_ALLOWLIST = new Set([
  'durationMs',
  'friendlyTitle',
  'storageProvider',
  'documentId',
  'versionId',
  'storageStatus',
  'httpStatus',
  'autoSaved',
  'provider',
  'objectKey',
]);

const SENSITIVE_KEYS = /token|secret|password|apikey|groq|authorization/i;

export function formatWorkflowLogDuration(durationMs: unknown): string | null {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return null;
  return formatDurationMs(durationMs);
}

function maskObjectKey(value: string): string {
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export function sanitizeWorkflowDebugDetails(
  details: Record<string, unknown> | undefined,
  showDebug: boolean,
): Record<string, string> {
  if (!details) return {};

  const output: Record<string, string> = {};

  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (!showDebug && !DEBUG_ALLOWLIST.has(key)) continue;

    if (key === 'durationMs' && typeof value === 'number') {
      output[key] = formatDurationMs(value);
      continue;
    }

    if (typeof value === 'string') {
      output[key] = key === 'objectKey' ? maskObjectKey(value) : value;
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = String(value);
    }
  }

  return output;
}
