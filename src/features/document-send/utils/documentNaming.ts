import { i18n } from '@/i18n';
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
    ? (originalFileName.split('.').pop() ?? 'pdf')
    : 'pdf';

  return generateDocumentName({
    documentType: metadata.documentType,
    supplier: metadata.supplier,
    documentDate: metadata.documentDate,
    suggestedVersion: metadata.suggestedVersion,
    extension,
  });
}

/**
 * A ficha de metadados que a tela de envio mostra antes de confirmar.
 *
 * Resolve na chamada porque roda durante o render; a contagem de caracteres passou a ser plural
 * de catálogo, e não `${n} caracteres` — em inglês a forma singular existe, e o texto truncado é
 * outra frase inteira, não um sufixo colado.
 */
export function metadataToFields(metadata: ExtractedMetadata): { label: string; value: string }[] {
  const statusLabel =
    metadata.analysisStatus === 'completed'
      ? i18n.t('documentSend:metadataValue.analiseConcluida')
      : metadata.analysisStatus === 'requires_review'
        ? i18n.t('documentSend:metadataValue.requerRevisao')
        : i18n.t('documentSend:metadataValue.erroNaAnalise');

  const fields: { label: string; value: string }[] = [
    {
      label: i18n.t('documentSend:metadataField.nomeOriginal'),
      value: metadata.originalFileName ?? '—',
    },
    { label: i18n.t('documentSend:metadataField.nomeSugerido'), value: metadata.suggestedName },
    {
      label: i18n.t('documentSend:metadataField.classeIdentificada'),
      value: metadata.documentType,
    },
    { label: i18n.t('documentSend:metadataField.statusDaAnalise'), value: statusLabel },
    {
      label: i18n.t('documentSend:metadataField.confiancaDaClassificacao'),
      value: `${Math.round(metadata.confidenceScore * 100)}%`,
    },
  ];

  if (metadata.classificationReason) {
    fields.push({
      label: i18n.t('documentSend:metadataField.justificativa'),
      value: metadata.classificationReason,
    });
  }

  if (metadata.missingFields && metadata.missingFields.length > 0) {
    fields.push({
      label: i18n.t('documentSend:metadataField.camposAusentes'),
      value: metadata.missingFields.join(', '),
    });
  }

  fields.push({
    label: i18n.t('documentSend:metadataField.versaoSugerida'),
    value: metadata.suggestedVersion,
  });

  if (metadata.textExtraction) {
    fields.push({
      label: i18n.t('documentSend:metadataField.textoExtraido'),
      value: metadata.textExtraction.truncated
        ? i18n.t('documentSend:metadataValue.caracteresTruncado', {
            count: metadata.textExtraction.charCount,
          })
        : i18n.t('documentSend:metadataValue.caracteres', {
            count: metadata.textExtraction.charCount,
          }),
    });
  }

  if (metadata.savedDocumentId) {
    fields.push({
      label: i18n.t('documentSend:metadataField.statusDePersistencia'),
      value: i18n.t('documentSend:metadataValue.metadadosConfirmados'),
    });
  }

  if (import.meta.env.DEV && metadata.storageStatus === 'pending') {
    fields.push({
      label: i18n.t('documentSend:metadataField.armazenamentoDeArquivo'),
      value: i18n.t('documentSend:metadataValue.pendente'),
    });
  }

  return fields;
}

export function getConfidenceLevel(score: number): 'high' | 'review' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'review';
  return 'low';
}
