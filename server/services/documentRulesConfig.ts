import { isDevelopmentEnvironment } from '../utils/workflowErrors.js';

/**
 * Mock global de regras só é permitido em desenvolvimento explícito com ALLOW_MOCK_RULES=true.
 * Produção/staging nunca usam DOCUMENT_CLASS_RULES no pipeline real.
 */
export function isAllowMockRulesEnabled(): boolean {
  if (!isDevelopmentEnvironment()) return false;
  const flag = process.env.ALLOW_MOCK_RULES?.trim().toLowerCase();
  return flag === 'true' || flag === '1';
}
