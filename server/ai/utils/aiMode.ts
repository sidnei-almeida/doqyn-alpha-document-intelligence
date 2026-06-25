import { AI_ERROR_MESSAGES } from '../constants.js';
import { AiAnalysisError } from '../utils/errors.js';

export type AiMode = 'groq' | 'no_ai';

export function getAiMode(): AiMode {
  const mode = process.env.AI_MODE?.trim().toLowerCase();
  if (mode === 'no_ai') return 'no_ai';
  return 'groq';
}

export function isNoAiMode(): boolean {
  return getAiMode() === 'no_ai';
}

export function getNoAiTemplate(): string {
  return process.env.NO_AI_TEMPLATE?.trim().toLowerCase() || 'nda';
}

function isProductionEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  return nodeEnv === 'production' || appEnv === 'production';
}

export function assertAiModeAllowed(): void {
  if (isNoAiMode() && isProductionEnvironment()) {
    throw new AiAnalysisError(
      AI_ERROR_MESSAGES.noAiProductionBlocked,
      'NO_AI_PRODUCTION_BLOCKED',
      503,
    );
  }
}
