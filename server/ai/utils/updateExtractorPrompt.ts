import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import {
  augmentConfidentialityClassForExtraction,
  isConfidentialityClassRule,
} from './documentClassHeuristics.js';
import {
  MAX_CHARS_PER_EXTRACTOR_CHUNK,
  MAX_EXTRACTOR_FIELDS_IN_PROMPT,
} from '../constants.js';

export type PreviousVersionContext = {
  documentId: string;
  currentVersionLabel: string;
  expectedNextVersionLabel: string;
  documentName: string;
  categoryName: string;
  metadataSummary: string;
  metadataPreview: Record<string, string | number | null>;
};

const PARTY_FIELD_KEYS = new Set(['parte_reveladora', 'parte_receptora']);

function limitExtractorChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    text:
      chunk.text.length > MAX_CHARS_PER_EXTRACTOR_CHUNK
        ? `${chunk.text.slice(0, MAX_CHARS_PER_EXTRACTOR_CHUNK)}…`
        : chunk.text,
  }));
}

function confidentialityExtractionHints(): string {
  return `
DOCUMENTO DE CONFIDENCIALIDADE / NDA — priorize identificar partes reveladora e receptora nos trechos.`;
}

export function buildUpdateExtractorPrompt(input: {
  chunks: RetrievedChunk[];
  selectedClass: DocumentClassRule;
  previousVersion: PreviousVersionContext;
}): { prompt: string; compactChunks: RetrievedChunk[] } {
  const compactChunks = limitExtractorChunks(input.chunks);
  const classForFields = augmentConfidentialityClassForExtraction(input.selectedClass);
  const sorted = [...classForFields.fields].sort((a, b) => {
    const partyBoost =
      Number(PARTY_FIELD_KEYS.has(b.key)) - Number(PARTY_FIELD_KEYS.has(a.key));
    if (partyBoost !== 0) return partyBoost;
    return Number(b.required) - Number(a.required);
  });
  const fields = sorted.slice(0, MAX_EXTRACTOR_FIELDS_IN_PROMPT).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    description: field.description,
    aliases: field.aliases?.slice(0, 10),
  }));

  const ndaHints = isConfidentialityClassRule(input.selectedClass)
    ? confidentialityExtractionHints()
    : '';

  const prompt = `Você analisa uma NOVA VERSÃO de um documento existente no DOQYN (atualização, não upload inicial).

Contexto da versão anterior:
- documentId: ${input.previousVersion.documentId}
- versão atual: ${input.previousVersion.currentVersionLabel}
- próxima versão esperada: ${input.previousVersion.expectedNextVersionLabel}
- nome atual: ${input.previousVersion.documentName}
- categoria atual: ${input.previousVersion.categoryName}
- resumo anterior: ${input.previousVersion.metadataSummary}
- metadados anteriores: ${JSON.stringify(input.previousVersion.metadataPreview, null, 2)}

Tarefa:
1. Extrair metadados do NOVO arquivo usando os campos em "fields".
2. Comparar com a versão anterior.
3. Informar principais mudanças, campos alterados e riscos.
4. Avaliar se parece o MESMO documento (atualização legítima) ou um documento DIFERENTE.
5. Se parecer documento diferente: seemsSameDocument=false, requiresReview=true, sem auto-confirmação silenciosa.
6. Use version="${input.previousVersion.expectedNextVersionLabel}" na resposta.
7. Responda APENAS com JSON válido, sem markdown.
${ndaHints}

Classe documental: ${input.selectedClass.name}
Descrição: ${input.selectedClass.description?.trim() || '—'}

fields:
${JSON.stringify(fields, null, 2)}

Trechos do NOVO arquivo:
${formatChunksForPrompt(compactChunks)}

Formato de resposta:
{"documentType":"string","version":"${input.previousVersion.expectedNextVersionLabel}","metadata":{"campo":{"label":"...","value":"...","normalizedValue":"...","confidence":0.9,"source":"document_text","evidence":{"pageNumber":1,"snippet":"..."}}},"missingFields":[],"requiresReview":false,"reviewReasons":[],"mainChanges":["..."],"changedFields":["campo"],"riskWarnings":["..."],"seemsSameDocument":true,"sameDocumentConfidence":0.9,"sameDocumentEvidence":["motivo curto"]}`;

  return { prompt, compactChunks };
}
