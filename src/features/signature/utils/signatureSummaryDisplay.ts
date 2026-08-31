import type {
  DocumentSignatureSummary,
  DocumentSignatureSummaryStatus,
} from '@/types/document-library';

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

export function signatureSummaryBadgeLabel(
  summary?: DocumentSignatureSummary | null,
): string | null {
  const normalized = normalizeSignatureSummary(summary);
  if (!normalized || !signatureSummaryHasActivity(normalized)) return null;

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
  if (!normalized || !signatureSummaryHasActivity(normalized)) {
    // Revogada conta como não solicitada, pela mesma razão da etiqueta.
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
    const date = new Date(normalized.latestSignedAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Assinado eletronicamente em ${date}.`;
  }

  const label = signatureSummaryLabel(normalized.status);
  return label ?? 'Assinatura em andamento.';
}

export function signedPdfDownloadName(documentName: string, verificationCode?: string): string {
  const base = documentName.replace(/\.pdf$/i, '') || 'documento';
  return verificationCode ? `${base}-assinado-${verificationCode}.pdf` : `${base}-assinado.pdf`;
}
