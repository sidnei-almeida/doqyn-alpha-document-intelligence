import type {
  ClassificationResult,
  DocumentClassRule,
  MetadataExtractionResult,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { AI_ERROR_MESSAGES } from '../constants.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { validateMetadataResult } from '../utils/validation.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import { completeJsonPrompt, type GroqPromptContext } from './groqClient.js';

function buildExtractorPrompt(
  chunks: RetrievedChunk[],
  selectedClass: DocumentClassRule,
): string {
  return `Você é um extrator documental do DOQYN.

Sua tarefa é extrair metadados usando apenas os campos definidos na regra da classe selecionada.

Regras obrigatórias:
1. Extraia apenas os campos listados em fields.
2. Não crie campos novos.
3. Não invente valores.
4. Se um valor não estiver explícito nos trechos, use value=null.
5. Todo valor extraído precisa ter uma evidência curta.
6. A evidência deve ser um trecho do texto fornecido.
7. Se um campo obrigatório estiver ausente, inclua em missingFields.
8. Se confidence for baixa, marque requiresReview=true.
9. Responda apenas JSON válido.

Classe selecionada:
${JSON.stringify(selectedClass, null, 2)}

Trechos relevantes:
${formatChunksForPrompt(chunks)}

Formato de saída:
{
  "documentType": "Contrato de Fornecedor",
  "version": "v1.0",
  "metadata": {
    "fornecedor": {
      "label": "Fornecedor",
      "value": "Acme Suprimentos",
      "normalizedValue": "Acme Suprimentos",
      "confidence": 0.96,
      "source": "document_text",
      "evidence": {
        "pageNumber": 1,
        "snippet": "CONTRATADA: Acme Suprimentos LTDA..."
      }
    }
  },
  "missingFields": [],
  "requiresReview": false,
  "reviewReasons": []
}`;
}

export async function extractMetadataWithRule(input: {
  chunks: RetrievedChunk[];
  selectedClass: DocumentClassRule;
  classification: ClassificationResult;
  context?: GroqPromptContext;
}): Promise<MetadataExtractionResult> {
  const requiredFieldKeys = input.selectedClass.fields.filter((f) => f.required).map((f) => f.key);

  try {
    const raw = await completeJsonPrompt(
      buildExtractorPrompt(input.chunks, input.selectedClass),
      {
        context: {
          ...input.context,
          operation: 'metadata_extraction',
        },
      },
    );
    const parsed = safeParseJsonFromModel<unknown>(raw);

    if (!parsed) {
      return {
        documentType: input.selectedClass.name,
        version: 'v1.0',
        metadata: {},
        missingFields: requiredFieldKeys,
        requiresReview: true,
        reviewReasons: [AI_ERROR_MESSAGES.invalidAiResponse],
      };
    }

    const validated = validateMetadataResult(parsed, input.selectedClass);

    return {
      ...validated,
      documentType: validated.documentType ?? input.selectedClass.name,
    };
  } catch {
    return {
      documentType: input.selectedClass.name,
      version: 'v1.0',
      metadata: {},
      missingFields: requiredFieldKeys,
      requiresReview: true,
      reviewReasons: [AI_ERROR_MESSAGES.analysisFailed],
    };
  }
}
