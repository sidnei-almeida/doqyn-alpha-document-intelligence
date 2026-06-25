import type { ExtractedMetadata } from '../types';
import {
  generateDocumentNameFromExtracted,
  getConfidenceLevel,
} from '../utils/documentNaming';

// TODO: substituir por integração real com análise documental
export async function processDocumentWithAI(file: File): Promise<ExtractedMetadata> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const lower = file.name.toLowerCase();

  let documentType = 'Documento';
  let supplier: string | undefined;
  let confidenceScore = 0.94;
  let value: string | undefined = 'R$ 27.500,00';
  let suggestedVersion = 'v2.0';

  if (lower.includes('contrato')) {
    documentType = 'Contrato';
    supplier = 'Acme Suprimentos';
    confidenceScore = 0.94;
    suggestedVersion = 'v2.0';
  } else if (lower.includes('nf') || lower.includes('nota')) {
    documentType = 'Nota Fiscal';
    supplier = 'FornecedorX';
    confidenceScore = 0.91;
    value = 'R$ 12.480,00';
    suggestedVersion = 'v1.0';
  } else if (lower.includes('pedido')) {
    documentType = 'Pedido de Compra';
    supplier = undefined;
    confidenceScore = 0.76;
    value = undefined;
    suggestedVersion = 'v1.0';
  } else if (lower.includes('sem_nome') || lower.includes('arquivo_sem')) {
    documentType = 'Indefinido';
    supplier = undefined;
    confidenceScore = 0.58;
    value = undefined;
    suggestedVersion = 'v1.0';
  } else if (lower.includes('boleto')) {
    documentType = 'Boleto';
    supplier = 'Fornecedor Y';
    confidenceScore = 0.88;
    value = 'R$ 890,00';
    suggestedVersion = 'v1.0';
  } else if (lower.includes('proposta')) {
    documentType = 'Proposta Comercial';
    supplier = 'Alpha Corp';
    confidenceScore = 0.85;
    suggestedVersion = 'v1.0';
  }

  const documentDate = new Date().toLocaleDateString('pt-BR');
  const level = getConfidenceLevel(confidenceScore);

  const base: Omit<ExtractedMetadata, 'suggestedName'> = {
    documentType,
    responsible: level === 'low' ? undefined : 'Mariana Ferreira',
    supplier,
    documentDate,
    value,
    suggestedVersion,
    confidenceScore,
    analysisStatus: level === 'low' ? 'requires_review' : 'completed',
  };

  const suggestedName = generateDocumentNameFromExtracted(
    {
      ...base,
      suggestedName: '',
    },
    file.name,
  );

  if (level === 'low') {
    return {
      ...base,
      documentType: 'Indefinido',
      suggestedName: suggestedName.replace(/^Documento_/, 'Documento_Requer_Revisao_'),
    };
  }

  if (level === 'review' && !supplier) {
    return {
      ...base,
      suggestedName: suggestedName.replace(
        /_Documento_/,
        '_sem_fornecedor_',
      ),
    };
  }

  return {
    ...base,
    suggestedName,
  };
}
