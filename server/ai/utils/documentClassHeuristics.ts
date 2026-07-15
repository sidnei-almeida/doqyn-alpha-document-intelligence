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
  'assinado em',
  'data de assinatura',
  'celebrado em',
  'firmado em',
  'prazo de vigência',
  'válido por',
  'anos',
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
    required: true,
    aliases: [
      'data de assinatura',
      'assinado em',
      'firmado em',
      'celebrado em',
      'datado de',
      'aos dias de',
    ],
    description:
      'Data de assinatura ou celebração do acordo (yyyy-mm-dd). Campo crítico para calcular validade. Procure no preâmbulo, cláusula de vigência e bloco de assinaturas.',
  },
  {
    key: 'prazo_vigencia',
    label: 'Prazo de vigência',
    type: 'string',
    required: false,
    aliases: [
      'vigência',
      'vigencia',
      'prazo de vigência',
      'prazo de vigencia',
      'válido por',
      'valido por',
      'prazo',
    ],
    description:
      'Prazo relativo de vigência (ex.: "5 anos", "24 meses"). Não invente data absoluta aqui.',
  },
  {
    key: 'data_validade',
    label: 'Validade',
    type: 'date',
    required: false,
    aliases: ['validade', 'vencimento', 'vigência fim', 'vigencia fim', 'término', 'termino'],
    description:
      'Data absoluta de término da vigência (yyyy-mm-dd). Se existir data_assinatura (ou emissão) E prazo_vigencia, CALCULE âncora+prazo. Sem âncora, deixe null — não use data de hoje/upload.',
  },
];

/** Garante campos de partes no pipeline de extração/validação mesmo com regras legadas no Mongo. */
export function augmentConfidentialityClassForExtraction(
  selectedClass: DocumentClassRule,
): DocumentClassRule {
  if (!isConfidentialityClassRule(selectedClass)) return selectedClass;

  const byKey = new Map(selectedClass.fields.map((field) => [field.key, field]));
  for (const field of CONFIDENTIALITY_PARTY_FIELDS) {
    const existing = byKey.get(field.key);
    if (!existing) {
      byKey.set(field.key, field);
      continue;
    }
    byKey.set(field.key, {
      ...existing,
      required: existing.required || field.required,
      aliases: [...new Set([...(existing.aliases ?? []), ...(field.aliases ?? [])])],
      description: field.description || existing.description,
    });
  }

  return {
    ...selectedClass,
    fields: [...byKey.values()],
  };
}
