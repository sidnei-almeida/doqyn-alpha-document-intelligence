import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';

export type ApiErrorDetails = Record<string, unknown>;

export type ParsedApiError = {
  status: number;
  code: string;
  message: string;
  friendlyMessage: string;
  details?: ApiErrorDetails;
  requestId?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetails;
  readonly requestId?: string;
  readonly friendlyMessage: string;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetails;
    requestId?: string;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.requestId = input.requestId;
    this.friendlyMessage = getFriendlyAuthErrorMessage(input.code, input.message, input.details);
  }
}

type ErrorBody = {
  ok?: boolean;
  message?: string;
  error?: string | { code?: string; message?: string };
  code?: string;
  details?: ApiErrorDetails;
  requestId?: string;
};

function extractCode(data: ErrorBody): string | undefined {
  if (typeof data.code === 'string' && data.code.trim()) return data.code.trim();
  if (typeof data.error === 'object' && data.error?.code) return data.error.code;
  return undefined;
}

function extractMessage(data: ErrorBody, fallback: string): string {
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data.error === 'object' && data.error?.message) return data.error.message;
  return fallback;
}

export function parseApiErrorBody(
  status: number,
  data: unknown,
  fallbackMessage = 'Não foi possível concluir a ação agora. Tente novamente.',
): ParsedApiError {
  const body = (data && typeof data === 'object' ? data : {}) as ErrorBody;
  const code = extractCode(body) ?? (status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : 'UNKNOWN_ERROR');
  const message = extractMessage(body, fallbackMessage);

  return {
    status,
    code,
    message,
    friendlyMessage: getFriendlyAuthErrorMessage(code, message, body.details),
    details: body.details,
    requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
  };
}

export async function parseApiError(
  response: Response,
  fallbackMessage?: string,
): Promise<ApiError> {
  let data: unknown = {};
  try {
    data = await response.json();
  } catch {
    // body vazio ou não-JSON
  }

  const parsed = parseApiErrorBody(response.status, data, fallbackMessage);
  return new ApiError(parsed);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function shouldLogoutForError(code: string): boolean {
  return ['INVALID_SESSION', 'SESSION_EXPIRED', 'AUTH_REQUIRED', 'NO_SESSION', 'UNAUTHORIZED'].includes(code);
}

export function shouldRedirectToLogin(code: string): boolean {
  return shouldLogoutForError(code);
}

export function isMembershipAccessError(code: string): boolean {
  return [
    'NO_ACTIVE_MEMBERSHIP',
    'NO_ACTIVE_TENANT',
    'MEMBERSHIP_PENDING',
    'MEMBERSHIP_BLOCKED',
    'MEMBERSHIP_REJECTED',
    'MEMBERSHIP_REMOVED',
    'TENANT_REQUIRED',
    'TENANT_INACTIVE',
    'TENANT_PROVISIONING_FAILED',
  ].includes(code);
}
