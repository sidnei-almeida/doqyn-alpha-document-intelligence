import type { WorkflowRequestContext } from '../types/workflowLog';


let eventCounter = 0;

export function summarizeWorkflowLogMessage(event: {
  level: string;
  stage: string;
  message: string;
  details?: Record<string, unknown>;
}): string {
  const friendly = event.details?.friendlyTitle;
  if (typeof friendly === 'string' && friendly.trim()) return friendly.trim();
  return event.message;
}

export function createWorkflowEventId(): string {
  eventCounter += 1;
  return `wf-${Date.now()}-${eventCounter}`;
}

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return createWorkflowEventId();
}

export function formatWorkflowTimestamp(date = new Date()): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function buildRequestHeaders(context?: WorkflowRequestContext): Record<string, string> {
  const headers: Record<string, string> = {};
  if (context?.requestId) headers['X-DOQYN-Request-Id'] = context.requestId;
  if (context?.batchId) headers['X-DOQYN-Batch-Id'] = context.batchId;
  if (context?.itemId) headers['X-DOQYN-Item-Id'] = context.itemId;
  if (context?.fileName) headers['X-DOQYN-File-Name'] = context.fileName;
  return headers;
}



