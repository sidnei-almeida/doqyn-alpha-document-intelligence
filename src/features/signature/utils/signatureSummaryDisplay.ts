import type { DocumentSignatureSummary, DocumentSignatureSummaryStatus } from '@/types/document-library';
import { formatDate } from '@/lib/formatLocale';

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

export function documentHasPendingSignature(
  doc: { signatureSummary?: DocumentSignatureSummary | null },
): boolean {
  const normalized = normalizeSignatureSummary(doc.signatureSummary);
  return normalized?.status === 'pending';
}

export function signatureSummaryHasActivity(
  summary?: DocumentSignatureSummary | null,
): boolean {
  const normalized = normalizeSignatureSummary(summary);
  return Boolean(normalized && normalized.status !== 'none');
}

export function signatureSummaryLabel(status: DocumentSignatureSummaryStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Assinatura pendente';
    case 'signed':
      return 'Assinado';
    case 'declined':
      return 'Recusado';
    case 'expired':
      return 'Expirado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return null;
  }
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

export function signatureSummaryBadgeLabel(summary?: DocumentSignatureSummary | null): string | null {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || normalized.status === 'none') return null;

  const base = signatureSummaryLabel(normalized.status);
  if (!base) return null;

  if (normalized.signedCount > 1) {
    return `${base} · ${normalized.signedCount}`;
  }

  if (normalized.status === 'pending' && normalized.signedCount === 1) {
    return `Parcial · ${normalized.signedCount}`;
  }

  return base;
}

export function signatureSummaryTooltip(summary?: DocumentSignatureSummary | null): string | null {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || normalized.signedSigners.length === 0) return null;

  const names = normalized.signedSigners.map((signer) => signer.name).join(', ');
  if (normalized.pendingCount > 0) {
    return `Assinaram: ${names}. ${normalized.pendingCount} pendente(s). Clique para ver detalhes.`;
  }
  return `Assinaram: ${names}. Clique para ver detalhes.`;
}

export function signatureDetailSummaryText(summary?: DocumentSignatureSummary | null): string {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || normalized.status === 'none') {
    return 'Nenhuma assinatura solicitada.';
  }

  if (normalized.signedSigners.length > 0) {
    const names = normalized.signedSigners.map((signer) => signer.name).join(', ');
    if (normalized.pendingCount > 0) {
      return `${normalized.signedCount} assinatura(s): ${names}. ${normalized.pendingCount} pendente(s).`;
    }
    return `${normalized.signedCount} assinatura(s): ${names}.`;
  }

  if (normalized.status === 'pending' && normalized.latestSignerName) {
    return `Assinatura pendente para ${normalized.latestSignerName}.`;
  }

  if (normalized.status === 'signed' && normalized.latestSignedAt) {
    const date = formatDate(new Date(normalized.latestSignedAt), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Assinado eletronicamente em ${date}.`;
  }

  const label = signatureSummaryLabel(normalized.status);
  return label ?? 'Assinatura em andamento.';
}

export function signedPdfDownloadName(
  documentName: string,
  verificationCode?: string,
): string {
  const base = documentName.replace(/\.pdf$/i, '') || 'documento';
  return verificationCode ? `${base}-assinado-${verificationCode}.pdf` : `${base}-assinado.pdf`;
}
