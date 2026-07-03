export class DocumentApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DocumentApiError';
    this.code = code;
  }
}

export async function parseDocumentApiError(response: Response): Promise<DocumentApiError> {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  };
  return new DocumentApiError(payload.message ?? 'Erro na requisição', payload.code);
}
