import { AI_ERROR_MESSAGES } from '../constants.js';
import { AiAnalysisError } from '../utils/errors.js';
import { resolveAnalysisProvider } from '../providers/resolveAnalysisProvider.js';

/** Garante que o provedor de análise ativo está configurado antes de análise real. */
export function assertAiProviderConfigured(): void {
  const provider = resolveAnalysisProvider();
  if (!provider.isConfigured()) {
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.aiProviderNotConfigured,
      provider.name === 'google_vision' ? 'AI_PROVIDER_NOT_ENABLED' : 'AI_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }
}
