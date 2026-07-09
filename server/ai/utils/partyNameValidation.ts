const INVALID_PARTY_PHRASE_PATTERNS = [
  /\bno\s+contexto\b/i,
  /\bnegocia[cç][aã]o/i,
  /\bao\s+receptor\b/i,
  /\bao\s+revelador\b/i,
  /\bparte\s+receptora\b/i,
  /\bparte\s+reveladora\b/i,
  /\bconfidencial/i,
  /\bde\s+um\s+lado\b/i,
  /\be\s+de\s+outro\b/i,
  /\bmediante\b/i,
  /\bcl[aá]usula\b/i,
  /\bobjeto\b/i,
  /\bvig[eê]ncia\b/i,
  /\bforo\b/i,
  /\binformac[oõ]es\b/i,
  /\bprote[cç][aã]o\b/i,
  /\bacordo\b/i,
  /\bcontrato\b/i,
  /\bdivulga[cç][aã]o\b/i,
];

const ROLE_ONLY_VALUES = new Set([
  'receptor',
  'receptora',
  'revelador',
  'reveladora',
  'contratante',
  'contratada',
  'contratado',
  'parte',
  'ao',
  'a',
]);

const STOP_WORDS = new Set([
  'de',
  'do',
  'da',
  'dos',
  'das',
  'ao',
  'a',
  'o',
  'os',
  'as',
  'e',
  'no',
  'na',
  'nos',
  'nas',
  'em',
  'para',
  'por',
  'um',
  'uma',
  'que',
  'se',
  'com',
  'sem',
]);

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Rejeita fragmentos jurídicos ("ao RECEPTOR no contexto...") — aceita pessoas/empresas. */
export function isValidPartyName(value: string): boolean {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3 || trimmed.length > 72) return false;

  if (INVALID_PARTY_PHRASE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return false;
  }

  const normalizedWhole = normalizeToken(trimmed);
  if (ROLE_ONLY_VALUES.has(normalizedWhole)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 7) return false;

  const meaningfulWords = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  if (meaningfulWords.length === 0) return false;

  if (meaningfulWords.every((word) => ROLE_ONLY_VALUES.has(normalizeToken(word)))) {
    return false;
  }

  if (/\b(LTDA|LTDA\.|S\.A\.|SA|ME|EPP|EIRELI|INC|LLC)\b/i.test(trimmed)) {
    return true;
  }

  // Nome de pessoa: 2–5 palavras com inicial maiúscula.
  if (
    /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç.'-]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç.'-]+){0,4}$/.test(
      trimmed,
    )
  ) {
    return true;
  }

  // Razão social curta em caixa alta: ACME COMERCIO, PAULAO SERVICOS.
  if (
    words.length <= 5 &&
    /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9.&'-]*(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9.&'-]*)*$/.test(
      trimmed,
    ) &&
    !/\b(RECEPTOR|REVELADOR|CONTRATANTE|CONTRATADA|CONTEXTO|NEGOCIAC)\b/.test(trimmed)
  ) {
    return true;
  }

  return false;
}

export function sanitizePartyMetadataValue(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!isValidPartyName(trimmed)) return null;
  return trimmed;
}
