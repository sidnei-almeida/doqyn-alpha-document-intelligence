/** Resultado da análise que determina o próximo passo na fila da Biblioteca. */
export type PostAnalysisAction = 'auto_confirm' | 'open_review' | 'ai_pause' | 'fail';

/**
 * Interpreta o valor bruto da configuração (testável sem import.meta).
 * Vazio, ausente ou qualquer valor diferente de "true" → desativado.
 */
export function parseUploadAutoConfirmEnabled(envValue: string | undefined | null): boolean {
  if (envValue === undefined || envValue === null || envValue.trim() === '') {
    return false;
  }
  return envValue.trim().toLowerCase() === 'true';
}

/**
 * Controla se a fila da Biblioteca pode chamar confirmAnalysis sem passar pelo ReviewDrawer.
 * Default: false — governança exige intenção explícita antes de salvar.
 *
 * Habilitar apenas em ambientes controlados:
 *   VITE_UPLOAD_AUTO_CONFIRM_ENABLED=true
 */
export function isUploadAutoConfirmEnabled(): boolean {
  return parseUploadAutoConfirmEnabled(import.meta.env.VITE_UPLOAD_AUTO_CONFIRM_ENABLED);
}

/**
 * Roteia o pós-análise da fila da Biblioteca.
 * - requires_review: sempre abre ReviewDrawer (independente do flag).
 * - completed + auto-confirm off: abre ReviewDrawer.
 * - completed + auto-confirm on: confirma automaticamente (comportamento legado da fila).
 */
export function resolvePostAnalysisAction(
  analysisStatus: string,
  autoConfirmEnabled: boolean,
): PostAnalysisAction {
  if (analysisStatus === 'completed') {
    return autoConfirmEnabled ? 'auto_confirm' : 'open_review';
  }
  if (analysisStatus === 'requires_review') {
    return 'open_review';
  }
  return 'fail';
}
