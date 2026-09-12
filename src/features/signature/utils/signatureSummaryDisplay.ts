import type {
  DocumentSignatureSummary,
  DocumentSignatureSummaryStatus,
} from '@/types/document-library';
import { i18n } from '@/i18n';
import { formatDate } from '@/i18n/formats';

/*
 * As frases desta camada moram em `common`, e não em `signature`: a etiqueta aparece na
 * Biblioteca, no painel Detalhes e na gaveta de assinaturas, e só `common` está garantidamente
 * carregado em todas elas quando a função roda.
 */

const EMPTY_SIGNATURE_SUMMARY: DocumentSignatureSummary = {
  status: 'none',
  pendingCount: 0,
  signedCount: 0,
  signedSigners: [],
  hasSignedPdf: false,
};

/** Garante campos agregados mesmo em payloads parciais ou cache legado. */
export function normalizeSignatureSummary(
  summary?: DocumentSignatureSummary | null,
): DocumentSignatureSummary | null {
  if (!summary) return null;
  return {
    ...EMPTY_SIGNATURE_SUMMARY,
    ...summary,
    pendingCount: summary.pendingCount ?? 0,
    signedCount: summary.signedCount ?? 0,
    signedSigners: summary.signedSigners ?? [],
    hasSignedPdf: summary.hasSignedPdf ?? false,
  };
}

export function documentHasPendingSignature(doc: {
  signatureSummary?: DocumentSignatureSummary | null;
}): boolean {
  const normalized = normalizeSignatureSummary(doc.signatureSummary);
  return normalized?.status === 'pending';
}

/**
 * Solicitação cancelada não é estado do documento — é ausência dele.
 *
 * Quem revoga está dizendo que não quer mais aquela assinatura, e uma etiqueta "Cancelado"
 * pendurada no card contradiz o próprio gesto. O servidor já pensa assim: ao revogar,
 * `syncDocumentSignatureStatus` grava `signatureStatus: 'none'` no documento. Só o resumo
 * calculado a partir das solicitações mantinha `cancelled` como estado próprio, e era ele que
 * a lista lia — duas fontes de verdade discordando na mesma tela.
 *
 * O histórico continua inteiro na gaveta de assinaturas, que lista as solicitações uma a uma.
 * O que sai é a etiqueta, não o registro.
 */
export function signatureSummaryHasActivity(summary?: DocumentSignatureSummary | null): boolean {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized) return false;
  return normalized.status !== 'none' && normalized.status !== 'cancelled';
}

const STATUS_KEYS: Partial<Record<DocumentSignatureSummaryStatus, string>> = {
  pending: 'common:signatureStatus.pending',
  signed: 'common:signatureStatus.signed',
  declined: 'common:signatureStatus.declined',
  expired: 'common:signatureStatus.expired',
  cancelled: 'common:signatureStatus.cancelled',
};

export function signatureSummaryLabel(status: DocumentSignatureSummaryStatus): string | null {
  const key = STATUS_KEYS[status];
  return key ? i18n.t(key) : null;
}

export function signatureSummaryBadgeVariant(
  status: DocumentSignatureSummaryStatus,
): 'pending' | 'success' | 'danger' | 'warning' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'signed':
      return 'success';
    case 'declined':
      return 'danger';
    case 'expired':
      return 'warning';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function signatureSummaryBadgeLabel(
  summary?: DocumentSignatureSummary | null,
): string | null {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || !signatureSummaryHasActivity(normalized)) return null;

  const base = signatureSummaryLabel(normalized.status);
  if (!base) return null;

  if (normalized.signedCount > 1) {
    return i18n.t('common:signatureSummary.withCount', {
      label: base,
      n: normalized.signedCount,
    });
  }

  if (normalized.status === 'pending' && normalized.signedCount === 1) {
    return i18n.t('common:signatureSummary.partial', { n: normalized.signedCount });
  }

  return base;
}

function signerNames(summary: DocumentSignatureSummary): string {
  return summary.signedSigners.map((signer) => signer.name).join(', ');
}

export function signatureSummaryTooltip(summary?: DocumentSignatureSummary | null): string | null {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || normalized.signedSigners.length === 0) return null;

  return [
    i18n.t('common:signatureSummary.signers', { names: signerNames(normalized) }),
    normalized.pendingCount > 0
      ? i18n.t('common:signatureSummary.pending', { count: normalized.pendingCount })
      : null,
    i18n.t('common:signatureSummary.clickForDetails'),
  ]
    .filter(Boolean)
    .join(' ');
}

export function signatureDetailSummaryText(summary?: DocumentSignatureSummary | null): string {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || !signatureSummaryHasActivity(normalized)) {
    // Revogada conta como não solicitada, pela mesma razão da etiqueta.
    return i18n.t('common:signatureSummary.none');
  }

  if (normalized.signedSigners.length > 0) {
    const signed = i18n.t('common:signatureSummary.signedCount', {
      count: normalized.signedCount,
      names: signerNames(normalized),
    });
    if (normalized.pendingCount > 0) {
      return `${signed} ${i18n.t('common:signatureSummary.pending', { count: normalized.pendingCount })}`;
    }
    return signed;
  }

  if (normalized.status === 'pending' && normalized.latestSignerName) {
    return i18n.t('common:signatureSummary.pendingFor', { name: normalized.latestSignerName });
  }

  if (normalized.status === 'signed' && normalized.latestSignedAt) {
    return i18n.t('common:signatureSummary.signedAt', {
      date: formatDate(normalized.latestSignedAt),
    });
  }

  const label = signatureSummaryLabel(normalized.status);
  return label ?? i18n.t('common:signatureSummary.inProgress');
}

export function signedPdfDownloadName(documentName: string, verificationCode?: string): string {
  const base = documentName.replace(/\.pdf$/i, '') || i18n.t('common:signatureSummary.fileBase');
  return verificationCode
    ? i18n.t('common:signatureSummary.fileSignedCode', { base, code: verificationCode })
    : i18n.t('common:signatureSummary.fileSigned', { base });
}
