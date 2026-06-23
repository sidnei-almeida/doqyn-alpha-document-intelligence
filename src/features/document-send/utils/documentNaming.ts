import type { ExtractedMetadata } from '../types';

type NameMetadataInput = {
  documentType: string;
  supplier?: string;
  documentDate?: string;
  suggestedVersion?: string;
  extension: string;
};

function removeAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizeSegment(value: string, fallback: string): string {
  const normalized = removeAccents(value)
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  return normalized || fallback;
}

function formatDateForName(date?: string): string | null {
  if (!date) return null;

  const brMatch = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const isoMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}

function normalizeVersion(version?: string): string {
  if (!version) return 'v1';
  const cleaned = version.replace(/^v/i, '').trim();
  return cleaned ? `v${cleaned.replace('.', '_')}` : 'v1';
}

export function generateDocumentName(metadata: NameMetadataInput): string {
  const type = sanitizeSegment(metadata.documentType, 'Documento');
  const supplier = metadata.supplier
    ? sanitizeSegment(metadata.supplier, 'Documento')
    : 'Documento';
  const date = formatDateForName(metadata.documentDate);
  const version = normalizeVersion(metadata.suggestedVersion);
  const ext = metadata.extension.replace(/^\./, '').toLowerCase() || 'pdf';

  const parts = [type, supplier];

  if (date) {
    parts.push(date);
  } else {
    parts.push('sem_data');
  }

  parts.push(version);

  return `${parts.join('_')}.${ext}`;
}

export function generateDocumentNameFromExtracted(
  metadata: Pick<
    ExtractedMetadata,
    'documentType' | 'supplier' | 'documentDate' | 'suggestedVersion' | 'suggestedName'
  >,
  originalFileName: string,
): string {
  const extension = originalFileName.includes('.')
    ? originalFileName.split('.').pop() ?? 'pdf'
    : 'pdf';

  return generateDocumentName({
    documentType: metadata.documentType,
    supplier: metadata.supplier,
    documentDate: metadata.documentDate,
    suggestedVersion: metadata.suggestedVersion,
    extension,
  });
}

export function metadataToFields(metadata: ExtractedMetadata): { label: string; value: string }[] {
  return [
    { label: 'Nome sugerido', value: metadata.suggestedName },
    { label: 'Tipo do documento', value: metadata.documentType },
    ...(metadata.responsible ? [{ label: 'Responsável', value: metadata.responsible }] : []),
    ...(metadata.supplier ? [{ label: 'Fornecedor', value: metadata.supplier }] : []),
    ...(metadata.documentDate ? [{ label: 'Data do documento', value: metadata.documentDate }] : []),
    ...(metadata.value ? [{ label: 'Valor', value: metadata.value }] : []),
    { label: 'Versão sugerida', value: metadata.suggestedVersion },
    {
      label: 'Confiança da extração',
      value: `${Math.round(metadata.confidenceScore * 100)}%`,
    },
  ];
}

export function getConfidenceLevel(score: number): 'high' | 'review' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'review';
  return 'low';
}
