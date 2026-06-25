export type WorkflowLogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';

export type WorkflowLogStage =
  | 'queue'
  | 'validation'
  | 'analysis'
  | 'classification'
  | 'extraction'
  | 'review'
  | 'auto'
  | 'confirmation'
  | 'persistence'
  | 'history'
  | 'ui'
  | 'error';

export type WorkflowLogEvent = {
  id: string;
  batchId?: string;
  itemId?: string;
  fileName?: string;
  level: WorkflowLogLevel;
  stage: WorkflowLogStage;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
};

export type WorkflowLogFilter =
  | 'all'
  | 'errors'
  | 'review'
  | 'saved'
  | 'current';

export type WorkflowLogInput = Omit<WorkflowLogEvent, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

export type WorkflowRequestContext = {
  requestId?: string;
  batchId?: string;
  itemId?: string;
  fileName?: string;
};
