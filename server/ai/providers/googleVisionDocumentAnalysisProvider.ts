import { AI_ERROR_MESSAGES } from '../constants.js';
import { AiAnalysisError } from '../utils/errors.js';
import type { DocumentAnalysisProvider } from './types.js';

/**
 * Stub para migração futura Groq → Google Cloud Vision AI.
 * Não implementar neste ciclo (Fase IA).
 */
export const googleVisionDocumentAnalysisProvider: DocumentAnalysisProvider = {
  name: 'google_vision',

  isConfigured() {
    return false;
  },

  classify() {
    throw new AiAnalysisError(
      'Google Cloud Vision AI ainda não está habilitado neste ambiente.',
      'AI_PROVIDER_NOT_ENABLED',
      503,
    );
  },

  extractMetadata() {
    throw new AiAnalysisError(
      'Google Cloud Vision AI ainda não está habilitado neste ambiente.',
      'AI_PROVIDER_NOT_ENABLED',
      503,
    );
  },
};

export function assertGoogleVisionNotSelected(): void {
  if (process.env.DOCUMENT_ANALYSIS_PROVIDER?.trim() === 'google_vision') {
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.aiProviderNotConfigured,
      'AI_PROVIDER_NOT_ENABLED',
      503,
    );
  }
}
