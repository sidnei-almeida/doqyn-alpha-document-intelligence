import type { DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import { MAX_CHARS_PER_EXTRACTOR_CHUNK, MAX_EXTRACTOR_FIELDS_IN_PROMPT } from '../constants.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import {
  augmentConfidentialityClassForExtraction,
  isConfidentialityClassRule,
} from './documentClassHeuristics.js';

export type CompactExtractorField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  aliases?: string[];
};

const PARTY_FIELD_KEYS = new Set(['parte_reveladora', 'parte_receptora']);
const VALIDITY_FIELD_KEYS = new Set([
  'data_assinatura',
  'data_emissao',
  'prazo_vigencia',
  'data_validade',
  'vigencia_inicio',
  'vigencia_fim',
]);

function limitExtractorChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    text:
      chunk.text.length > MAX_CHARS_PER_EXTRACTOR_CHUNK
        ? `${chunk.text.slice(0, MAX_CHARS_PER_EXTRACTOR_CHUNK)}…`
        : chunk.text,
  }));
}

function toCompactFields(selectedClass: DocumentClassRule): CompactExtractorField[] {
  const classForFields = augmentConfidentialityClassForExtraction(selectedClass);
  const sorted = [...classForFields.fields].sort((a, b) => {
    const partyBoost =
      Number(PARTY_FIELD_KEYS.has(b.key)) - Number(PARTY_FIELD_KEYS.has(a.key));
    if (partyBoost !== 0) return partyBoost;
    const validityBoost =
      Number(VALIDITY_FIELD_KEYS.has(b.key)) - Number(VALIDITY_FIELD_KEYS.has(a.key));
    if (validityBoost !== 0) return validityBoost;
    return Number(b.required) - Number(a.required);
  });

  return sorted.slice(0, MAX_EXTRACTOR_FIELDS_IN_PROMPT).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    description: field.description,
    aliases: field.aliases?.slice(0, 10),
  }));
}

function confidentialityExtractionHints(): string {
  return `
DOCUMENTO DE CONFIDENCIALIDADE / NDA — instruções obrigatórias:
1. Sua prioridade máxima é identificar as PESSOAS ou EMPRESAS de cada parte.
2. Procure nomes no preâmbulo, qualificação das partes, cabeçalho e bloco de assinaturas.
3. Padrões comuns nos trechos:
   - "PARTE REVELADORA:" ou "REVELADOR:" seguido de nome/razão social
   - "PARTE RECEPTORA:" ou "RECEPTOR:" seguido de nome/razão social
   - "de um lado, [NOME COMPLETO ou RAZÃO SOCIAL], ... e de outro, [NOME COMPLETO ou RAZÃO SOCIAL]"
   - "CONTRATANTE:" / "CONTRATADA:" com nomes logo após os dois pontos
4. Use nomes próprios ou razão social (ex.: "Sidnei Almeida", "Paulão Comércio Ltda", "ACME S.A.").
5. NÃO preencha parte_reveladora nem parte_receptora com:
   - título do documento ("ACORDO DE CONFIDENCIALIDADE", "NDA", etc.)
   - cláusulas, objeto, vigência, foro, multa ou texto jurídico genérico
   - rótulos soltos ("RECEPTOR", "REVELADOR", "ao receptor", "no contexto de negociações")
6. Se não encontrar o nome de uma parte nos trechos, use null — não invente nem copie o título.
7. CPF/CNPJ servem só para confirmar a parte; o value deve ser o NOME, não o documento.
8. Datas e vigência (PRIORIDADE MÁXIMA junto com as partes):
   - data_assinatura é OBRIGATÓRIA quando o documento tiver prazo/vigência. Procure com agressividade: preâmbulo, cláusula de vigência, "assinado/firmado/celebrado em", "aos X dias de [mês] de [ano]", rodapé e bloco de assinaturas.
   - Extraia prazo_vigencia relativo ("7 anos", "24 meses", "pelo prazo de 5 anos"). Não confunda prazo com data absoluta.
   - Se tiver data âncora (assinatura/emissão) E prazo_vigencia, CALCULE data_validade = âncora + prazo (yyyy-mm-dd) e cite no evidence.snippet que foi calculado.
   - Sem data âncora no texto: data_validade = null. Nunca use data de hoje, upload ou criação do arquivo.
   - Se estiver em dúvida entre duas datas, prefira a de assinatura/celebração à data de emissão de anexo.

Exemplo de metadados corretos para NDA:
{"parte_reveladora":{"value":"Paulão Comércio Ltda","normalizedValue":"Paulão Comércio Ltda","confidence":0.92,"evidence":{"snippet":"PARTE REVELADORA: Paulão Comércio Ltda"}},"parte_receptora":{"value":"Cliente Beta S.A.","normalizedValue":"Cliente Beta S.A.","confidence":0.9,"evidence":{"snippet":"PARTE RECEPTORA: Cliente Beta S.A."}},"data_assinatura":{"value":"2024-03-10","normalizedValue":"2024-03-10","confidence":0.9,"evidence":{"snippet":"assinado em 10 de março de 2024"}},"prazo_vigencia":{"value":"5 anos","normalizedValue":"5 anos","confidence":0.88,"evidence":{"snippet":"vigência de 5 anos"}},"data_validade":{"value":"2029-03-10","normalizedValue":"2029-03-10","confidence":0.86,"evidence":{"snippet":"Calculado: 2024-03-10 + 5 anos"}}}`;
}

/**
 * Tudo que não muda entre documentos vem antes dos trechos, de propósito: o cache de prompt da
 * Groq casa por prefixo e desconta 50% do que reaproveitar. Como instruções, campos da classe e
 * formato de resposta são idênticos para todo documento da mesma classe, deixá-los no início
 * transforma essa parte em prefixo cacheável; o texto do documento, que é sempre diferente,
 * fica no fim.
 */
export function buildCompactExtractorPrompt(
  chunks: RetrievedChunk[],
  selectedClass: DocumentClassRule,
): { prompt: string; compactChunks: RetrievedChunk[] } {
  const compactChunks = limitExtractorChunks(chunks);
  const fields = toCompactFields(selectedClass);
  const ndaHints = isConfidentialityClassRule(selectedClass) ? confidentialityExtractionHints() : '';

  const prompt = `Você extrai metadados estruturados de documentos PDF para o DOQYN.

Tarefa: preencher os campos listados em "fields" usando SOMENTE os trechos fornecidos.

Regras gerais:
1. Extraia apenas os campos em fields — respeite key, label, type e aliases de cada um.
2. Leia description e aliases de cada campo para saber ONDE e O QUE buscar no texto.
3. Não invente valores. Se o dado não aparecer nos trechos, use null.
4. Para cada valor preenchido, inclua evidence.snippet com o trecho literal que comprova o dado.
5. missingFields = keys dos campos required que ficaram null.
6. requiresReview=true se faltar campo obrigatório ou se a confiança for baixa.
7. Responda APENAS com JSON válido, sem markdown.
${ndaHints}

Classe documental: ${selectedClass.name}
Descrição: ${selectedClass.description?.trim() || '—'}

fields (ordem de prioridade):
${JSON.stringify(fields, null, 2)}

Formato de resposta:
{"documentType":"string","version":"v1.0","metadata":{"campo":{"label":"...","value":"...","normalizedValue":"...","confidence":0.9,"source":"document_text","evidence":{"pageNumber":1,"snippet":"..."}}},"missingFields":[],"requiresReview":false,"reviewReasons":[]}

Trechos do documento:
${formatChunksForPrompt(compactChunks)}`;

  return { prompt, compactChunks };
}
