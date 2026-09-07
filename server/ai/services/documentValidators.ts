import type { DocumentRuleField, FieldType } from '../types/documentAi.types.js';

/**
 * Dígito verificador, não só contagem de dígitos.
 *
 * A validação antiga aceitava qualquer sequência do tamanho certo, então CPF e CNPJ inventados pelo
 * modelo passavam sem resistência — e são justamente o tipo de campo que o modelo inventa com mais
 * facilidade, porque tem formato fixo e aparência convincente. O dígito verificador é aritmética
 * fechada: número alucinado quase nunca fecha a conta, número lido do papel sempre fecha. Vinte
 * linhas transformam invenção em erro detectável.
 *
 * O algoritmo é o mesmo dos dois: soma ponderada dos dígitos, resto por 11, e o dígito é 0 quando
 * o resto é menor que 2.
 */
function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Sequência de um dígito só fecha a conta por acidente aritmético, e nunca é documento real. */
function isRepeatedSequence(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function validateCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || isRepeatedSequence(digits)) return false;

  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[9])) return false;

  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(digits[10]);
}

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || isRepeatedSequence(digits)) return false;

  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[12])) return false;

  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(digits[13]);
}

export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeDate(value: string): string | null {
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const brDash = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (brDash) return `${brDash[3]}-${brDash[2]}-${brDash[1]}`;

  return null;
}

export function normalizeCurrency(value: string | number): {
  amount: number | null;
  currency: string;
} {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { amount: value, currency: 'BRL' };
  }

  const raw = String(value).trim();
  const cleaned = raw
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const amount = Number.parseFloat(cleaned);
  if (!Number.isFinite(amount)) {
    return { amount: null, currency: 'BRL' };
  }

  return { amount, currency: 'BRL' };
}

/**
 * Rótulos que o modelo às vezes copia junto com o dado.
 *
 * O prompt manda remover ("CONTRATANTE:", "Nome:") e ele obedece na maior parte
 * das vezes — mas em campo de número o rótulo vem colado no valor com tanta
 * frequência que virou padrão: `numero_nota` chegava como "Fatura nº
 * FAT-2026-00318-7". Como `value` guarda o literal do documento e só
 * `normalizedValue` é usado para buscar, ordenar e comparar, limpar aqui não
 * perde nada e conserta a comparação.
 */
/**
 * `n[ºo°]` juntava a letra "o" com os ordinais tipográficos, sem fronteira de palavra e com a
 * flag `i`. Qualquer nome com as letras "no" nos primeiros trinta caracteres era decapitado:
 * `MERIDIANO SOFTWORKS LTDA.` virava `SOFTWORKS LTDA.`, `NORTIS ENGENHARIA S.A.` virava
 * `RTIS ENGENHARIA S.A.`, `ALDEIA TECNOLOGIA...` virava `LOGIA E AUTOMAÇÃO...`. Em português isso
 * alcança Nortis, Tecnologia, Meridiano, Bruno, Antônio, Nogueira, Fernando, Nova — e sem barulho
 * nenhum, porque `value` continuava correto e só `normalizedValue` saía mutilado. Como é
 * `normalizedValue` que busca, ordena, compara e alerta, o dado certo existia e não era achável.
 *
 * `º` e `°` continuam soltos: são caracteres que nunca aparecem no meio de uma palavra. O "no"
 * em ASCII, que é o ambíguo, agora exige não vir depois de letra e vir seguido de espaço ou
 * dígito — "Nota fiscal no 4471" continua limpando, "NORTIS" não.
 */
const FIELD_LABEL_PREFIX =
  /^(?:[\p{L}][\p{L}\s]{0,28}?\s*)?(?:n[º°]\.?|n\.[º°]|(?<![\p{L}])no\.?(?=[\s\d])|:)\s*/iu;

function stripLeadingFieldLabel(value: string): string {
  const stripped = value.replace(FIELD_LABEL_PREFIX, '').trim();
  // Rótulo sem dado atrás não é rótulo: era o próprio valor.
  return stripped.length >= 2 ? stripped : value;
}

export function normalizeExtractedValue(
  value: string | number | null,
  fieldType: FieldType,
): string | number | null {
  if (value === null || value === '') return null;

  if (fieldType === 'date' && typeof value === 'string') {
    return normalizeDate(value);
  }

  if (fieldType === 'currency') {
    const { amount } = normalizeCurrency(value);
    return amount;
  }

  if (fieldType === 'number') {
    const parsed =
      typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (fieldType === 'string' && typeof value === 'string') {
    return stripLeadingFieldLabel(value.trim()) || null;
  }

  return value;
}

export function normalizeStringFieldValue(
  value: string | number | null,
  field: DocumentRuleField,
): string | number | null {
  if (value === null || value === '') return null;

  if (field.key.includes('cnpj') || field.key.includes('cpf')) {
    if (typeof value === 'string') {
      if (validateCnpj(value)) return normalizeCnpj(value);
      if (validateCpf(value)) return normalizeCpf(value);
      return value.trim();
    }
  }

  return normalizeExtractedValue(value, field.type);
}
