import type { DocumentClassRule, ExtractedMetadataField } from '../types/documentAi.types.js';
import {
  ensurePdfExtension,
  limitFileNameLength,
  sanitizeFileNameSegment,
} from '../utils/sanitizeFileName.js';
import { stripSensitiveIdentifiersFromFileName as stripSensitiveIdentifiersFromFileNameCore } from '../../../shared/storageFileName.js';
import { normalizeDate } from './documentValidators.js';

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
    return 'Documento';
  }

  return sanitizeFileNameSegment(value, 'Documento');
}

function normalizeVersion(version: string): string {
  const cleaned = version.replace(/^v/i, '').trim();
  return cleaned ? cleaned.replace('.', '_') : '1';
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

    const value = formatFieldValueForName(key, input.metadata[key]);
    name = name.replace(placeholder, value);
  }

  name = name
    .split('_')
    .filter((segment) => segment && segment !== 'sem_data')
    .join('_');

  const fileName = ensurePdfExtension(`${name}.pdf`.replace(/\.pdf\.pdf$/i, '.pdf'));
  const limited = limitFileNameLength(fileName);
  if (input.preventSensitiveDataInFileName === false) {
    return limited;
  }
  return limitFileNameLength(stripSensitiveIdentifiersFromFileName(limited));
}
