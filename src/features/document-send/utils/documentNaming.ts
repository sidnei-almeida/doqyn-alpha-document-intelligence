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
  const statusLabel =
    metadata.analysisStatus === 'completed'
      ? 'Análise concluída'
      : metadata.analysisStatus === 'requires_review'
        ? 'Requer revisão'
        : 'Erro na análise';

  const fields: { label: string; value: string }[] = [
    { label: 'Nome original', value: metadata.originalFileName ?? '—' },
    { label: 'Nome sugerido', value: metadata.suggestedName },
    { label: 'Classe identificada', value: metadata.documentType },
    { label: 'Status da análise', value: statusLabel },
    {
      label: 'Confiança da classificação',
      value: `${Math.round(metadata.confidenceScore * 100)}%`,
    },
  ];

  if (metadata.classificationReason) {
    fields.push({ label: 'Justificativa', value: metadata.classificationReason });
  }

  if (metadata.missingFields && metadata.missingFields.length > 0) {
    fields.push({
      label: 'Campos ausentes',
      value: metadata.missingFields.join(', '),
    });
  }

  fields.push({ label: 'Versão sugerida', value: metadata.suggestedVersion });

  if (metadata.textExtraction) {
    fields.push({
      label: 'Texto extraído',
      value: metadata.textExtraction.truncated
        ? `${metadata.textExtraction.charCount} caracteres (truncado)`
        : `${metadata.textExtraction.charCount} caracteres`,
    });
  }

  if (metadata.savedDocumentId) {
    fields.push({ label: 'Status de persistência', value: 'Metadados confirmados' });
  }

  if (import.meta.env.DEV && metadata.storageStatus === 'pending') {
    fields.push({ label: 'Armazenamento de arquivo', value: 'Pendente' });
  }

  return fields;
}

export function getConfidenceLevel(score: number): 'high' | 'review' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'review';
  return 'low';
}
