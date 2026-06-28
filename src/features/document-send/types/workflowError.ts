export type WorkflowErrorCategory =
  | 'configuration'
  | 'authentication'
  | 'permission'
  | 'database'
  | 'ai'
  | 'upload'
  | 'storage'
  | 'unexpected';

export type WorkflowErrorAction = {
  label: string;
  href: string;
};

export type WorkflowErrorBody = {
  code: string;
  category: WorkflowErrorCategory;
  title: string;
  message: string;
  suggestion?: string;
  action?: WorkflowErrorAction;
  devHint?: string;
  technicalDetail?: string;
};

export type WorkflowErrorApiResponse = {
  message?: string;
  code?: string;
  error?: WorkflowErrorBody;
  requestId?: string;
};

export type WorkflowErrorDisplay = WorkflowErrorBody & {
  toastMessage: string;
  requestId?: string;
  endpoint?: string;
};
