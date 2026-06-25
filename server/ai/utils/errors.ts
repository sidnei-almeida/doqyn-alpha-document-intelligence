export class AiAnalysisError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = 'AiAnalysisError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isAiAnalysisError(error: unknown): error is AiAnalysisError {
  return error instanceof AiAnalysisError;
}
