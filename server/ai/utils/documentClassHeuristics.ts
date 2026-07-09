import type { DocumentClassRule, DocumentRuleField } from '../types/documentAi.types.js';

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

/** Campos mínimos para extração de NDA — injetados quando regras antigas do tenant só têm titulo/referencia. */
export const CONFIDENTIALITY_PARTY_FIELDS: DocumentRuleField[] = [
  {
    key: 'parte_reveladora',
    label: 'Parte reveladora',
    type: 'string',
    required: false,
    aliases: [
      'parte reveladora',
      'revelador',
      'divulgador',
      'contratante',
      'proprietário das informações',
      'proprietario das informacoes',
      'de um lado',
    ],
    description:
      'Nome completo ou razão social de quem revela as informações confidenciais. Procure no preâmbulo/qualificação das partes.',
  },
  {
    key: 'parte_receptora',
    label: 'Parte receptora',
    type: 'string',
    required: true,
    aliases: [
      'parte receptora',
      'receptor',
      'recebedor',
      'contratado',
      'contratada',
      'destinatário',
      'destinatario',
      'e de outro',
    ],
    description:
      'Nome completo ou razão social de quem recebe as informações confidenciais. Procure no preâmbulo/qualificação das partes.',
  },
  {
    key: 'data_assinatura',
    label: 'Data de assinatura',
    type: 'date',
    required: false,
    aliases: ['data de assinatura', 'assinado em', 'firmado em', 'celebrado em'],
    description: 'Data de assinatura ou celebração do acordo.',
  },
];

/** Garante campos de partes no pipeline de extração/validação mesmo com regras legadas no Mongo. */
export function augmentConfidentialityClassForExtraction(
  selectedClass: DocumentClassRule,
): DocumentClassRule {
  if (!isConfidentialityClassRule(selectedClass)) return selectedClass;

  const existingKeys = new Set(selectedClass.fields.map((field) => field.key));
  const missingPartyFields = CONFIDENTIALITY_PARTY_FIELDS.filter(
    (field) => !existingKeys.has(field.key),
  );
  if (missingPartyFields.length === 0) return selectedClass;

  return {
    ...selectedClass,
    fields: [...missingPartyFields, ...selectedClass.fields],
  };
}
