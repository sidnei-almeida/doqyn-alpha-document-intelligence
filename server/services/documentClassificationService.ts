import { logger } from '../utils/logger.js';

export async function classifyDocument(
  documentType: string,
  metadata: Record<string, unknown>,
) {
  logger.debug('documentClassificationService — modo simulado', { documentType });

  // Future: ML classification model or rule engine
  const categoryMap: Record<string, string> = {
    Contrato: 'legal',
    'Nota Fiscal': 'financial',
    Relatório: 'report',
    'Política Interna': 'policy',
    Comprovante: 'receipt',
  };

  return {
    category: categoryMap[documentType] ?? 'general',
    confidence: 0.92,
    metadata,
  };
}
