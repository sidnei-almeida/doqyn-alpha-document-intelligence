import { i18n } from '@/i18n';
import ptDocuments from '@/i18n/catalog/pt-BR/documents.json';

type PreviewErrorKey = keyof typeof ptDocuments.previewError;
type PreviewStatusKey = keyof typeof ptDocuments.previewStatus;

const PREVIEW_ERROR_KEYS: Record<string, PreviewErrorKey> = {
  PREVIEW_NOT_READY: 'notReady',
  PREVIEW_FAILED: 'failed',
  PREVIEW_NOT_FOUND: 'notFound',
  DOCUMENT_ACCESS_DENIED: 'accessDenied',
  DOCUMENT_NOT_FOUND: 'documentNotFound',
  DOCUMENT_FORBIDDEN: 'accessDenied',
  SESSION_EXPIRED: 'sessionExpired',
  UNAUTHORIZED: 'sessionExpired',
};

/**
 * A frase no idioma ativo, com o `pt-BR` embutido como rede.
 *
 * Roda também em teste Node, onde o catálogo `documents` não foi carregado — sem a rede, a
 * mensagem viraria a chave crua. O JSON só entra no chunk de documentos, não na casca.
 */
function previewErrorPhrase(key: PreviewErrorKey): string {
  const fullKey = `documents:previewError.${key}`;
  return i18n.exists(fullKey) ? i18n.t(fullKey) : ptDocuments.previewError[key];
}

function previewStatusPhrase(key: PreviewStatusKey): string {
  const fullKey = `documents:previewStatus.${key}`;
  return i18n.exists(fullKey) ? i18n.t(fullKey) : ptDocuments.previewStatus[key];
}

function resolveErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function getPreviewErrorMessage(error: unknown): string {
  const code = resolveErrorCode(error);
  if (code && PREVIEW_ERROR_KEYS[code]) {
    return previewErrorPhrase(PREVIEW_ERROR_KEYS[code]);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return previewErrorPhrase('loadFailed');
}

export function getPreviewStatusLabel(status?: string): string {
  switch (status) {
    case 'ready':
      return previewStatusPhrase('ready');
    case 'failed':
      return previewStatusPhrase('failed');
    case 'skipped':
      return previewStatusPhrase('skipped');
    case 'missing':
      return previewStatusPhrase('missing');
    default:
      return previewStatusPhrase('unavailable');
  }
}
