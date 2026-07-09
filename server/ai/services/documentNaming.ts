import type { DocumentClassRule, ExtractedMetadataField, RetrievedChunk } from '../types/documentAi.types.js';
import { isConfidentialityClassRule } from '../utils/documentClassHeuristics.js';
import {
  ensurePdfExtension,
  limitFileNameLength,
  sanitizeFileNameSegment,
} from '../utils/sanitizeFileName.js';
import { stripSensitiveIdentifiersFromFileName as stripSensitiveIdentifiersFromFileNameCore } from '../../../shared/storageFileName.js';
import { normalizeDate } from './documentValidators.js';
import {
  enrichMetadataWithPartyHeuristics,
  isValidPartyName,
  normalizePartyValue,
} from '../utils/partyMetadataHeuristics.js';

const CATEGORY_SLUG_PREFIXES = [
  'juridico',
  'financeiro',
  'contratos',
  'compras',
  'operacional',
  'recursos_humanos',
  'recursos-humanos',
  'rh',
];

const GENERIC_TITLE_PATTERNS = [
  /acordo\s+de\s+confidencialidade/i,
  /nao\s+concorrenc/i,
  /não\s+concorrênc/i,
  /nao\s+aliciamento/i,
  /não\s+aliciamento/i,
  /prote[cç][aã]o\s+de\s+informa[cç]/i,
  /non[- ]disclosure/i,
  /\bnda\b/i,
];

function getFieldDisplayValue(
  key: string,
  field: ExtractedMetadataField | undefined,
): string | null {
  if (!field) return null;

  const raw = field.normalizedValue ?? field.value;
  if (raw === null || raw === '') return null;

  if (typeof raw === 'number') return String(raw);

  if (key.includes('data')) {
    return normalizeDate(raw) ?? raw;
  }

  return raw;
}

function normalizeCompareToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function looksLikeProperName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  if (/\b(LTDA|LTDA\.|S\.A\.|SA|ME|EPP|EIRELI|INC|LLC)\b/i.test(trimmed)) return true;
  if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+(\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+)+$/.test(trimmed)) {
    return true;
  }
  return (
    /[a-záàâãéêíóôõúç]{2,}/i.test(trimmed) &&
    !GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed))
  );
}

function isGenericTitleValue(value: string, className: string): boolean {
  const normalized = normalizeCompareToken(value);
  if (!normalized || normalized === 'documento') return true;
  if (normalized === normalizeCompareToken(className)) return true;

  const upperRatio =
    value.replace(/[^A-Za-zÀ-ÿ]/g, '').length > 0
      ? (value.replace(/[^A-ZÀ-Ÿ]/g, '').length / value.replace(/[^A-Za-zÀ-ÿ]/g, '').length)
      : 0;

  if (value.length > 36 && upperRatio > 0.75 && !looksLikeProperName(value)) {
    return true;
  }

  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(value)) && !looksLikeProperName(value)) {
    return true;
  }

  return false;
}

const PARTY_METADATA_KEYS = new Set([
  'parte_reveladora',
  'parte_receptora',
  'contratante',
  'contratada',
  'cliente',
  'beneficiario',
]);

function formatFieldValueForName(
  key: string,
  field: ExtractedMetadataField | undefined,
): string {
  const value = getFieldDisplayValue(key, field);

  if (!value) {
    if (key.includes('data')) return 'sem_data';
    if (key === 'numero_nota') return 'sem_numero';
    if (key === 'numero_pedido') return 'sem_pedido';
    if (key === 'fornecedor') return 'Documento';
    if (key === 'parte_receptora') return 'Documento';
    if (key === 'parte_reveladora') return 'Documento';
    return 'Documento';
  }

  if (PARTY_METADATA_KEYS.has(key) && !isValidPartyName(value)) {
    return 'Documento';
  }

  if (key === 'titulo' && isGenericTitleValue(value, '')) {
    return 'Documento';
  }

  return sanitizeFileNameSegment(value, 'Documento');
}

function normalizeVersion(version: string): string {
  const cleaned = version.replace(/^v/i, '').trim();
  return cleaned ? cleaned.replace('.', '_') : '1';
}

function stripCategorySlugPrefix(name: string): string {
  let result = name;
  for (const slug of CATEGORY_SLUG_PREFIXES) {
    const pattern = new RegExp(`^${slug}_`, 'i');
    result = result.replace(pattern, '');
  }
  return result;
}

function partySegment(
  key: string,
  field: ExtractedMetadataField | undefined,
  className: string,
): string | null {
  const raw = getFieldDisplayValue(key, field);
  if (!raw || !isValidPartyName(raw)) return null;

  const formatted = sanitizeFileNameSegment(normalizePartyValue(raw), 'Documento');
  if (!formatted || formatted === 'Documento') return null;
  if (isGenericTitleValue(raw, className)) return null;
  return formatted;
}

const BARE_TYPE_TOKENS = new Set([
  'nda',
  'contrato',
  'documento',
  'boleto',
  'nota',
  'fiscal',
  'proposta',
  'politica',
  'acordo',
]);

const TEMPLATE_CONNECTOR_SEGMENTS = new Set(['e']);

function meaningfulNameSegments(name: string): string[] {
  return name
    .replace(/\.pdf$/i, '')
    .split('_')
    .map((segment) => segment.trim())
    .filter(
      (segment) =>
        segment &&
        segment !== 'sem_data' &&
        segment !== 'Documento' &&
        !TEMPLATE_CONNECTOR_SEGMENTS.has(segment.toLowerCase()) &&
        !BARE_TYPE_TOKENS.has(segment.toLowerCase()) &&
        !/^v\d+([._]\d+)?$/i.test(segment) &&
        !/^\d{1,4}([._]\d{1,4})?$/.test(segment),
    );
}

function isBareGenericFileName(name: string): boolean {
  const segments = meaningfulNameSegments(name);
  return segments.length === 0;
}

function sanitizeOriginalStem(originalFileName: string, className: string): string | null {
  const stem = originalFileName.replace(/\.pdf$/i, '').trim();
  if (!stem || stem.length < 3) return null;
  const lowered = stem.toLowerCase();
  if (['nda', 'documento', 'upload', 'arquivo', 'file', 'scan', 'doc'].includes(lowered)) {
    return null;
  }
  if (isGenericTitleValue(stem, className)) return null;
  const sanitized = sanitizeFileNameSegment(stem, '');
  if (!sanitized || isGenericTitleValue(sanitized.replace(/_/g, ' '), className)) return null;
  return sanitized;
}

function buildRichFallbackName(input: {
  originalFileName: string;
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
  version: string;
}): string {
  const enriched = enrichMetadataWithPartyHeuristics({
    chunks: [],
    selectedClass: input.selectedClass,
    metadata: input.metadata,
  });

  const disambiguated = buildDisambiguatedBaseName(input.selectedClass, enriched);
  if (!isBareGenericFileName(disambiguated)) {
    return disambiguated;
  }

  const originalStem = sanitizeOriginalStem(input.originalFileName, input.selectedClass.name);
  if (originalStem) {
    const prefix = isConfidentialityClassRule(input.selectedClass) ? 'NDA' : 'Doc';
    return `${prefix}_${originalStem}`;
  }

  const data =
    formatFieldValueForName('data_assinatura', enriched.data_assinatura) !== 'sem_data'
      ? formatFieldValueForName('data_assinatura', enriched.data_assinatura)
      : formatFieldValueForName('data_emissao', enriched.data_emissao);

  const prefix = isConfidentialityClassRule(input.selectedClass)
    ? 'NDA'
    : sanitizeFileNameSegment(input.selectedClass.name.split(' ')[0] ?? 'Documento', 'Documento');

  const version = normalizeVersion(input.version);
  const parts = [prefix, 'SemPartesIdentificadas', data !== 'sem_data' ? data : null, `v${version}`].filter(
    Boolean,
  ) as string[];

  return parts.join('_');
}

function buildDisambiguatedBaseName(
  selectedClass: DocumentClassRule,
  metadata: Record<string, ExtractedMetadataField>,
): string {
  if (isConfidentialityClassRule(selectedClass)) {
    const reveladora = partySegment('parte_reveladora', metadata.parte_reveladora, selectedClass.name);
    const receptora = partySegment('parte_receptora', metadata.parte_receptora, selectedClass.name);
    const data = formatFieldValueForName('data_assinatura', metadata.data_assinatura);

    const parts = ['NDA'];
    if (reveladora && receptora) {
      parts.push(`${reveladora}_e_${receptora}`);
    } else if (receptora) {
      parts.push(receptora);
    } else if (reveladora) {
      parts.push(reveladora);
    } else {
      const fornecedor = partySegment('fornecedor', metadata.fornecedor, selectedClass.name);
      const cliente = partySegment('cliente', metadata.cliente, selectedClass.name);
      if (fornecedor) parts.push(fornecedor);
      else if (cliente) parts.push(cliente);
    }

    if (data !== 'sem_data') parts.push(data);
    return parts.join('_');
  }

  const fornecedor = partySegment('fornecedor', metadata.fornecedor, selectedClass.name);
  const cliente = partySegment('cliente', metadata.cliente, selectedClass.name);
  const beneficiario = partySegment('beneficiario', metadata.beneficiario, selectedClass.name);
  const numeroNota = formatFieldValueForName('numero_nota', metadata.numero_nota);
  const numeroPedido = formatFieldValueForName('numero_pedido', metadata.numero_pedido);
  const data =
    formatFieldValueForName('data_assinatura', metadata.data_assinatura) !== 'sem_data'
      ? formatFieldValueForName('data_assinatura', metadata.data_assinatura)
      : formatFieldValueForName('data_emissao', metadata.data_emissao);

  const typePrefix = sanitizeFileNameSegment(selectedClass.name.split(' ')[0] ?? 'Documento', 'Documento');
  const parts = [typePrefix];

  if (fornecedor && fornecedor !== 'Documento') parts.push(fornecedor);
  else if (cliente && cliente !== 'Documento') parts.push(cliente);
  else if (beneficiario && beneficiario !== 'Documento') parts.push(beneficiario);

  if (numeroNota !== 'sem_numero') parts.push(numeroNota);
  if (numeroPedido !== 'sem_pedido') parts.push(numeroPedido);
  if (data !== 'sem_data') parts.push(data);

  return parts.join('_');
}

function nameHasPartyContext(
  name: string,
  metadata: Record<string, ExtractedMetadataField>,
): boolean {
  const haystack = normalizeCompareToken(name);
  const partyKeys = [
    'parte_reveladora',
    'parte_receptora',
    'fornecedor',
    'cliente',
    'beneficiario',
    'contratante',
    'contratada',
  ];

  return partyKeys.some((key) => {
    const value = getFieldDisplayValue(key, metadata[key]);
    if (!value || !isValidPartyName(value)) return false;
    const token = normalizeCompareToken(value);
    return token.length >= 4 && haystack.includes(token.slice(0, Math.min(token.length, 12)));
  });
}

function isGenericGeneratedName(
  name: string,
  selectedClass: DocumentClassRule,
  metadata: Record<string, ExtractedMetadataField>,
): boolean {
  const base = name.replace(/\.pdf$/i, '');
  const segments = base.split('_').filter(Boolean);

  if (segments.length <= 1) return true;

  const titulo = getFieldDisplayValue('titulo', metadata.titulo);
  if (titulo && isGenericTitleValue(titulo, selectedClass.name)) {
    const tituloToken = normalizeCompareToken(titulo);
    if (tituloToken && normalizeCompareToken(base).includes(tituloToken.slice(0, 24))) {
      return true;
    }
  }

  if (isConfidentialityClassRule(selectedClass) && !nameHasPartyContext(base, metadata)) {
    return true;
  }

  if (segments.every((segment) => segment.toLowerCase() === 'documento')) {
    return true;
  }

  return false;
}

function applyNamingTemplate(input: {
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
  version: string;
}): string {
  const versionToken = normalizeVersion(input.version);
  let name = input.selectedClass.namingTemplate;

  const placeholders = name.match(/\{([^}]+)\}/g) ?? [];
  for (const placeholder of placeholders) {
    const key = placeholder.slice(1, -1);
    if (key === 'version') {
      name = name.replace(placeholder, versionToken);
      continue;
    }

    const field = input.metadata[key];
    if (key === 'titulo') {
      const raw = getFieldDisplayValue('titulo', field);
      const value =
        raw && !isGenericTitleValue(raw, input.selectedClass.name)
          ? sanitizeFileNameSegment(raw, 'Documento')
          : 'Documento';
      name = name.replace(placeholder, value);
      continue;
    }

    const value = formatFieldValueForName(key, field);
    name = name.replace(placeholder, value);
  }

  return name
    .split('_')
    .filter((segment) => segment && segment !== 'sem_data' && segment !== 'Documento')
    .join('_');
}

/** Remove CPF/CNPJ (11 ou 14 dígitos) de segmentos de nome de arquivo. */
export function stripSensitiveIdentifiersFromFileName(fileName: string): string {
  return stripSensitiveIdentifiersFromFileNameCore(fileName);
}

export function generateRecommendedFileName(input: {
  originalFileName: string;
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
  version: string;
  preventSensitiveDataInFileName?: boolean;
  sourceChunks?: RetrievedChunk[];
}): string {
  const metadata = enrichMetadataWithPartyHeuristics({
    chunks: input.sourceChunks ?? [],
    selectedClass: input.selectedClass,
    metadata: input.metadata,
  });

  let name = applyNamingTemplate({
    selectedClass: input.selectedClass,
    metadata,
    version: input.version,
  });

  name = stripCategorySlugPrefix(name);

  const disambiguated = buildDisambiguatedBaseName(input.selectedClass, metadata);
  const templateIsWeak = !name || isGenericGeneratedName(name, input.selectedClass, metadata);
  const disambiguatedIsBetter =
    !isBareGenericFileName(disambiguated) &&
    meaningfulNameSegments(disambiguated).length >= meaningfulNameSegments(name).length;

  if (templateIsWeak || disambiguatedIsBetter) {
    if (!isBareGenericFileName(disambiguated)) {
      name = disambiguated;
    }
  }

  if (isConfidentialityClassRule(input.selectedClass) && !nameHasPartyContext(name, metadata)) {
    if (!isBareGenericFileName(disambiguated)) {
      name = disambiguated;
    } else {
      name = buildRichFallbackName({ ...input, metadata });
    }
  }

  if (!name || isBareGenericFileName(name)) {
    name = buildRichFallbackName({ ...input, metadata });
  }

  name = name
    .split('_')
    .filter((segment) => segment && segment !== 'sem_data' && segment !== 'Documento')
    .join('_');

  if (!name || isBareGenericFileName(name)) {
    name = buildRichFallbackName({ ...input, metadata });
  }

  const fileName = ensurePdfExtension(`${name}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf'));
  const limited = limitFileNameLength(fileName);
  if (input.preventSensitiveDataInFileName === false) {
    return limited;
  }
  return limitFileNameLength(stripSensitiveIdentifiersFromFileName(limited));
}
