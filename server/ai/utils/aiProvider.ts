import { AI_ERROR_MESSAGES } from '../constants.js';
import { AiAnalysisError } from '../utils/errors.js';
import { isGroqApiKeyConfigured } from '../services/groqClient.js';

/** Garante que o provedor Groq está configurado antes de análise real. */
export function assertAiProviderConfigured(): void {
  if (!isGroqApiKeyConfigured()) {
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.aiProviderNotConfigured,
      'AI_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }
}
