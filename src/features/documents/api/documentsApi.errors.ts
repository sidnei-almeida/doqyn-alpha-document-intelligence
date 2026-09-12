import { i18n } from '@/i18n';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';

export class DocumentApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DocumentApiError';
    this.code = code;
  }
}

/**
 * A frase sai do catálogo pelo `code`, como em `ApiError`.
 *
 * O `message` do servidor é português e existe para log (P1 do plano de i18n). Enquanto este
 * erro o carregava cru, toda tela que mostrava `err.message` — portal de assinatura, gaveta de
 * assinaturas, viewer — falava português com a interface em inglês. Sem `code`, não há o que
 * traduzir, e a frase do servidor continua sendo melhor que nenhuma.
 */
export async function parseDocumentApiError(response: Response): Promise<DocumentApiError> {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  };
  const message = payload.code
    ? getFriendlyAuthErrorMessage(payload.code, payload.message)
    : (payload.message ?? i18n.t('common:feedback.requestFailed'));
  return new DocumentApiError(message, payload.code);
}
