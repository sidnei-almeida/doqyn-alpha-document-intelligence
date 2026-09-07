/**
 * Conferências que olham para mais de um campo ao mesmo tempo.
 *
 * Cada campo isolado pode estar impecável e o conjunto ser impossível. Uma validade anterior à
 * assinatura, uma vigência que termina antes de começar: as duas datas existem no documento, as
 * duas estão em `yyyy-mm-dd`, as duas têm trecho que as comprova, e ainda assim uma delas foi lida
 * no papel errado. Nenhum agente que julga campo a campo detecta isso — não por falta de
 * inteligência, mas porque a informação que denuncia o erro não está dentro de nenhum dos dois
 * campos, e sim na relação entre eles.
 *
 * Custo zero: é aritmética de data e dígito verificador, sem chamada a modelo nenhum.
 */
import type { DocumentClassRule, ExtractedMetadataField } from '../types/documentAi.types.js';
import { validateCnpj, validateCpf } from '../services/documentValidators.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Datas que marcam o começo de alguma coisa. */
const ANCHOR_HINTS = [
  'assinatura',
  'emissao',
  'emissão',
  'inicio',
  'início',
  'lavratura',
  'celebracao',
  'celebração',
];
/** Datas que marcam o fim, e que por isso não podem ser anteriores às de cima. */
const TERMINAL_HINTS = [
  'validade',
  'vencimento',
  'fim',
  'termino',
  'término',
  'expiracao',
  'expiração',
];

export type CoherenceProblem = {
  key: string;
  detail: string;
};

function isoValue(extracted: ExtractedMetadataField | undefined): string | null {
  const value = extracted?.normalizedValue ?? extracted?.value;
  if (typeof value !== 'string') return null;
  return ISO_DATE.test(value) ? value : null;
}

function keyMatches(key: string, hints: string[]): boolean {
  const normalized = key.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

/**
 * Data terminal anterior à âncora.
 *
 * Compara todos os pares, não um par fixo: o tenant nomeia os campos como quiser, e amarrar a
 * conferência a `data_assinatura` e `data_validade` deixaria de fora `vigencia_inicio`/`vigencia_fim`
 * e qualquer nome que alguém invente amanhã. O que identifica o papel é a palavra na chave.
 */
function checkDateOrder(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
}): CoherenceProblem[] {
  const dateFields = input.selectedClass.fields.filter((field) => field.type === 'date');
  const anchors = dateFields.filter((field) => keyMatches(field.key, ANCHOR_HINTS));
  const terminals = dateFields.filter((field) => keyMatches(field.key, TERMINAL_HINTS));

  const problems: CoherenceProblem[] = [];
  for (const terminal of terminals) {
    const terminalValue = isoValue(input.metadata[terminal.key]);
    if (!terminalValue) continue;

    for (const anchor of anchors) {
      const anchorValue = isoValue(input.metadata[anchor.key]);
      if (!anchorValue) continue;

      if (terminalValue < anchorValue) {
        problems.push({
          key: terminal.key,
          detail: `${terminal.label} (${terminalValue}) é anterior a ${anchor.label} (${anchorValue}) — uma das duas foi lida no papel errado`,
        });
      }
    }
  }

  return problems;
}

/**
 * CPF e CNPJ com dígito verificador que não fecha.
 *
 * São os campos que o modelo inventa com mais facilidade: formato fixo, aparência convincente, e
 * nada no texto ao redor que denuncie. O dígito verificador é aritmética fechada — número lido do
 * papel fecha a conta, número inventado quase nunca.
 */
function checkTaxIds(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
}): CoherenceProblem[] {
  const problems: CoherenceProblem[] = [];

  for (const field of input.selectedClass.fields) {
    const key = field.key.toLowerCase();
    const isCpf = key.includes('cpf');
    const isCnpj = key.includes('cnpj');
    if (!isCpf && !isCnpj) continue;

    const raw = input.metadata[field.key]?.normalizedValue ?? input.metadata[field.key]?.value;
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const text = String(raw).trim();
    if (!text) continue;

    const valid = isCpf ? validateCpf(text) : validateCnpj(text);
    if (!valid) {
      problems.push({
        key: field.key,
        detail: `${isCpf ? 'CPF' : 'CNPJ'} "${text}" não fecha o dígito verificador — número inventado ou lido errado pelo OCR`,
      });
    }
  }

  return problems;
}

/**
 * O classificador e o extrator discordam sobre o que o documento é.
 *
 * Os dois leem o mesmo papel e os dois declaram um tipo — o classificador antes de escolher a
 * pasta, o extrator ao montar o nome do arquivo. Concordância não prova acerto, mas discordância
 * prova que um dos dois errou, e sai de graça porque as duas leituras já aconteceram.
 *
 * A comparação é frouxa de propósito: "NDA" e "ACORDO DE CONFIDENCIALIDADE" são o mesmo documento
 * com dois nomes, e acusar isso como divergência gastaria revisão humana com sinônimo.
 */
function normalizeType(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function typesDisagree(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = normalizeType(a);
  const right = normalizeType(b);
  if (!left || !right) return false;
  if (left === right) return false;

  // Uma palavra em comum já basta para tratar como o mesmo tipo dito de duas formas.
  const leftWords = new Set(left.split(' ').filter((word) => word.length > 2));
  const rightWords = right.split(' ').filter((word) => word.length > 2);
  return !rightWords.some((word) => leftWords.has(word));
}

export function findCoherenceProblems(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
}): CoherenceProblem[] {
  return [...checkDateOrder(input), ...checkTaxIds(input)];
}
