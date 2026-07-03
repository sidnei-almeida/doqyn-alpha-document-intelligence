import type { DocumentClassRule } from '../types/documentAi.types.js';

const CONFIDENTIALITY_HINT_PATTERNS = [
  /nda/i,
  /confidencial/i,
  /confidentiality/i,
  /não divulgação/i,
  /nao divulgacao/i,
  /acordo de confid/i,
  /sigilo/i,
];

/** Termos extras de recuperação quando a classe do tenant parece ser de confidencialidade. */
export const CONFIDENTIALITY_RETRIEVAL_TERMS = [
  'nda',
  'acordo de confidencialidade',
  'não divulgação',
  'nao divulgacao',
  'não concorrência',
  'nao concorrencia',
  'não aliciamento',
  'nao aliciamento',
  'parte reveladora',
  'parte receptora',
  'revelador',
  'receptor',
  'multa',
  'infração',
  'infracao',
  'vigência',
  'vigencia',
  'sigilo',
  'informações confidenciais',
  'informacoes confidenciais',
  'segredo comercial',
];

function classTextHaystack(
  docClass: Pick<DocumentClassRule, 'name' | 'description' | 'keywords'>,
): string {
  return [docClass.name, docClass.description ?? '', ...(docClass.keywords ?? [])].join(' ');
}

/** Heurística baseada em nome/keywords/descrição do tenant — nunca em ID fixo de seed. */
export function isConfidentialityClassRule(
  docClass: Pick<DocumentClassRule, 'name' | 'description' | 'keywords'>,
): boolean {
  const haystack = classTextHaystack(docClass);
  return CONFIDENTIALITY_HINT_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function extraRetrievalTermsForClass(docClass: DocumentClassRule): string[] {
  if (!isConfidentialityClassRule(docClass)) return [];
  return CONFIDENTIALITY_RETRIEVAL_TERMS;
}
