/**
 * Quantos valores do formato deste campo existem no documento.
 *
 * A triagem determinística conferia se o valor extraído era *possível*: tem snippet, o snippet
 * existe no texto, a data está em ISO. Passava tudo isso e mesmo assim estava errado, porque
 * possível não é o mesmo que certo. `juridico_04` traz quatro datas — a lavratura por extenso, o
 * selo de reconhecimento de firma dois dias depois, e mais duas no cabeçalho; o extrator pegou o
 * selo. `operacional_01` traz cinco — três ensaios, a emissão e o carimbo de tempo do ICP-Brasil;
 * pegou o carimbo. Nos dois casos o snippet era real e a data era válida.
 *
 * O que faltava era saber que havia disputa. Quando o documento tem um único candidato do formato,
 * escolher é trivial e não vale gastar chamada. Quando tem quatro, a escolha é justamente onde o
 * erro mora — e é isso que este módulo detecta, de graça, antes de decidir se o Avaliador roda.
 */
import type { DocumentRuleField, RetrievedChunk } from '../types/documentAi.types.js';
import { normalizeDateValue } from './derivedDates.js';

const MAX_CANDIDATES = 8;

/**
 * Formas de data em algarismos.
 *
 * **A lista é deliberadamente parcial e isso importa.** Data inteiramente por extenso — "aos treze
 * dias do mês de abril do ano de dois mil e vinte e seis" — não entra aqui, porque reconhecer
 * numeral escrito em português é um problema à parte. E é justamente essa a data certa em
 * `juridico_04`: as que aparecem em algarismos são o selo do cartório e a data de impressão, as
 * duas erradas. Ou seja, a lista pode conter só candidatos ruins.
 *
 * Por isso ela é oferecida ao Avaliador como "estas são as que estão em algarismos", nunca como
 * "escolha uma destas" — quem usa a lista precisa saber que a resposta certa pode estar fora dela.
 */
const DATE_SHAPES = [
  /\d{4}-\d{1,2}-\d{1,2}/g,
  /\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/g,
  /\d{1,2}\s*(?:de\s+)?[a-zA-ZÀ-ÿ]{3,12}\.?\s*(?:de\s+)?\d{4}/g,
];

const NUMBER_SHAPE = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})|\bR\$\s*\d+(?:[.,]\d+)?/g;

/**
 * Identificador: código com letra e número, ou número precedido de marcador de numeração.
 * Deliberadamente estreito — número solto no meio de um texto não é identificador de nada, e
 * contá-lo como candidato transformaria todo documento em disputa.
 */
const IDENTIFIER_SHAPES = [
  /\b[A-Z]{2,}[-/]?\d{2,}(?:[-/]\d+)*\b/g,
  /\bn[º°o]\.?\s*[:\s]?\s*([A-Z0-9][A-Z0-9.\-/]{2,})/gi,
];

const IDENTIFIER_KEY_HINTS = [
  'numero',
  'número',
  'nota',
  'protocolo',
  'referencia',
  'referência',
  'codigo',
  'código',
];

function chunkText(chunks: RetrievedChunk[]): string {
  return chunks.map((chunk) => chunk.text).join('\n');
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, MAX_CANDIDATES);
}

function dateCandidates(text: string): string[] {
  const found: string[] = [];
  for (const shape of DATE_SHAPES) {
    for (const match of text.matchAll(shape)) {
      const iso = normalizeDateValue(match[0]);
      // Só entra o que normaliza: "12 de páginas de 2026" casa com a forma e não é data.
      if (iso) found.push(iso);
    }
  }
  return dedupe(found);
}

function numberCandidates(text: string): string[] {
  return dedupe([...text.matchAll(NUMBER_SHAPE)].map((match) => match[0]));
}

function identifierCandidates(text: string): string[] {
  const found: string[] = [];
  for (const shape of IDENTIFIER_SHAPES) {
    for (const match of text.matchAll(shape)) {
      found.push((match[1] ?? match[0]).trim());
    }
  }
  return dedupe(found);
}

function looksLikeIdentifierField(field: DocumentRuleField): boolean {
  const haystack = `${field.key} ${field.label}`.toLowerCase();
  return IDENTIFIER_KEY_HINTS.some((hint) => haystack.includes(hint));
}

/**
 * Candidatos do formato do campo presentes no documento. Lista vazia quando o formato não é
 * detectável de forma barata — nome de pessoa e razão social ficam de fora de propósito: distinguir
 * "quem paga" de "quem recebe" não é questão de formato, e é o prompt do Avaliador que resolve,
 * com as dicas por classe.
 */
export function findFieldCandidates(input: {
  field: DocumentRuleField;
  chunks: RetrievedChunk[];
}): string[] {
  const text = chunkText(input.chunks);

  if (input.field.type === 'date') return dateCandidates(text);
  if (input.field.type === 'currency' || input.field.type === 'number') {
    return numberCandidates(text);
  }
  if (input.field.type === 'string' && looksLikeIdentifierField(input.field)) {
    return identifierCandidates(text);
  }

  return [];
}
