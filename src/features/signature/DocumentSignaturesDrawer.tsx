import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { useConfirm } from '@/components/confirm/useConfirm';
import { buildRevokeSignatureRequestConfirm } from '@/components/confirm/confirmMessages';
import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { cn, formatDate } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import {
  cancelDocumentSignatureRequest,
  downloadSignatureRequestEvidence,
  downloadSignatureRequestSignedPdf,
  fetchDocumentSignatureRequests,
  type DocumentSignatureRequestEntry,
} from '@/features/signature/api/signatureApi';
import type { DocumentSignatureSummaryStatus } from '@/types/document-library';
import {
  signatureSummaryBadgeVariant,
  signatureSummaryLabel,
  signedPdfDownloadName,
} from '@/features/signature/utils/signatureSummaryDisplay';
import { DocumentApiError } from '@/features/documents/api/documentsApi.errors';
import { invalidateSignatureQueries } from '@/features/signature/utils/invalidateSignatureQueries';
import {
  canRevokeSignatureRequestEntry,
  isSignatureRequestEntryOpen,
} from '@/features/signature/utils/signatureRequestStatus';

type DocumentSignaturesDrawerProps = {
  document: DocumentListItem | null;
  onClose: () => void;
};

function mapRequestStatusToSummaryStatus(status: string): DocumentSignatureSummaryStatus {
  if (status === 'pending' || status === 'partially_signed') return 'pending';
  if (status === 'signed') return 'signed';
  if (status === 'declined') return 'declined';
  if (status === 'expired') return 'expired';
  if (status === 'cancelled') return 'cancelled';
  return 'none';
}

function requestStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
    case 'partially_signed':
      return 'Pendente';
    case 'signed':
      return 'Assinado';
    case 'declined':
      return 'Recusado';
    case 'expired':
      return 'Expirado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

function SignatureRequestCard({
  entry,
  onDownloadSigned,
  onDownloadEvidence,
  onRevoke,
  downloadingSigned,
  downloadingEvidence,
  revokingId,
}: {
  entry: DocumentSignatureRequestEntry;
  onDownloadSigned: (requestId: string, verificationCode?: string) => void;
  onDownloadEvidence: (requestId: string) => void;
  onRevoke: (entry: DocumentSignatureRequestEntry) => void;
  downloadingSigned: string | null;
  downloadingEvidence: string | null;
  revokingId: string | null;
}) {
  const signer = entry.signers[0];
  const verificationCode = entry.signature?.verificationCode;

  return (
    <section className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={signatureSummaryBadgeVariant(mapRequestStatusToSummaryStatus(entry.status))}
        >
          {requestStatusLabel(entry.status)}
        </Badge>
        {verificationCode ? (
          <span className="font-mono text-micro text-doqyn-subtle">{verificationCode}</span>
        ) : null}
      </div>

      <dl className="mt-3 space-y-2 text-caption">
        <div>
          <dt className="text-doqyn-muted">Signatário</dt>
          <dd className="text-doqyn-text">{signer?.name ?? '—'}</dd>
          <dd className="text-doqyn-subtle">{signer?.emailMasked ?? '—'}</dd>
          {signer?.phoneMasked ? <dd className="text-doqyn-subtle">{signer.phoneMasked}</dd> : null}
          {signer?.organizationName ? (
            <dd className="text-doqyn-subtle">{signer.organizationName}</dd>
          ) : null}
        </div>
        <div>
          <dt className="text-doqyn-muted">Solicitado por</dt>
          <dd>{entry.requestedByName}</dd>
        </div>
        <div>
          <dt className="text-doqyn-muted">Solicitado em</dt>
          <dd>{formatDate(entry.createdAt)}</dd>
        </div>
        {entry.signature?.signedAt ? (
          <div>
            <dt className="text-doqyn-muted">Assinado em</dt>
            <dd>{formatDate(entry.signature.signedAt)}</dd>
          </div>
        ) : null}
        {entry.expiresAt ? (
          <div>
            <dt className="text-doqyn-muted">Expira em</dt>
            <dd>{formatDate(entry.expiresAt)}</dd>
          </div>
        ) : null}
      </dl>

      {entry.message ? (
        <blockquote className="mt-3 rounded-md border border-doqyn-border-subtle px-3 py-2 text-caption leading-relaxed text-doqyn-subtle">
          {entry.message}
        </blockquote>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canRevokeSignatureRequestEntry(entry) ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-doqyn-danger hover:bg-doqyn-danger/10 hover:text-doqyn-danger"
            disabled={revokingId === entry.signatureRequestId}
            onClick={() => onRevoke(entry)}
            data-testid="signature-drawer-revoke"
          >
            {revokingId === entry.signatureRequestId ? 'Revogando…' : 'Revogar'}
          </Button>
        ) : null}
        {entry.signature?.hasSignedPdf ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={downloadingSigned === entry.signatureRequestId}
            onClick={() =>
              onDownloadSigned(entry.signatureRequestId, entry.signature?.verificationCode)
            }
            data-testid="signature-drawer-download-signed"
          >
            {downloadingSigned === entry.signatureRequestId ? 'Baixando…' : 'Baixar PDF assinado'}
          </Button>
        ) : null}
        {entry.signature?.hasEvidence ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={downloadingEvidence === entry.signatureRequestId}
            onClick={() => onDownloadEvidence(entry.signatureRequestId)}
          >
            {downloadingEvidence === entry.signatureRequestId ? 'Baixando…' : 'Baixar evidências'}
          </Button>
        ) : null}
        {verificationCode ? (
          <Link
            to={`/verify/signature/${encodeURIComponent(verificationCode)}`}
            className="inline-flex items-center gap-1 text-caption text-doqyn-accent-active hover:underline"
            data-testid="signature-drawer-verification-link"
          >
            Abrir validador
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function DocumentSignaturesDrawer({ document, onClose }: DocumentSignaturesDrawerProps) {
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const confirm = useConfirm();
  const [downloadingSigned, setDownloadingSigned] = useState<string | null>(null);
  const [downloadingEvidence, setDownloadingEvidence] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['document-signature-requests', document?.documentId],
    enabled: Boolean(document?.documentId),
    queryFn: () => fetchDocumentSignatureRequests(document!.documentId),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasPending = items.some((item) => isSignatureRequestEntryOpen(item));
      return hasPending ? 8_000 : false;
    },
  });

  useEffect(() => {
    if (!document || !data?.items?.length) return;
    const hasPendingRequest = data.items.some((item) => isSignatureRequestEntryOpen(item));
    const listShowsPending = document.signatureSummary?.status === 'pending';
    if (!hasPendingRequest && listShowsPending) {
      void invalidateSignatureQueries(queryClient, tenant?.tenantId ?? user?.companyId);
    }
  }, [data?.items, document, queryClient, tenant?.tenantId, user?.companyId]);

  if (!document) return null;

  const documentName = document.currentFileName ?? document.displayName;
  const summaryLabel = document.signatureSummary
    ? signatureSummaryLabel(document.signatureSummary.status)
    : null;

  const handleDownloadSigned = async (signatureRequestId: string, verificationCode?: string) => {
    setDownloadingSigned(signatureRequestId);
    setError(null);
    try {
      const blob = await downloadSignatureRequestSignedPdf(signatureRequestId);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = signedPdfDownloadName(documentName, verificationCode);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar PDF assinado.');
    } finally {
      setDownloadingSigned(null);
    }
  };

  const handleDownloadEvidence = async (signatureRequestId: string) => {
    setDownloadingEvidence(signatureRequestId);
    setError(null);
    try {
      const blob = await downloadSignatureRequestEvidence(signatureRequestId);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `evidencias-${signatureRequestId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar evidências.');
    } finally {
      setDownloadingEvidence(null);
    }
  };

  const handleRevoke = async (entry: DocumentSignatureRequestEntry) => {
    const signerName = entry.signers[0]?.name ?? 'signatário';
    const confirmed = await confirm(buildRevokeSignatureRequestConfirm(signerName));
    if (!confirmed) return;

    setRevokingId(entry.signatureRequestId);
    setError(null);
    try {
      await cancelDocumentSignatureRequest(document.documentId, entry.signatureRequestId);
      toast.success('Solicitação de assinatura revogada.');
      await refetch();
      await invalidateSignatureQueries(queryClient, tenant?.tenantId ?? user?.companyId);
    } catch (err) {
      if (
        err instanceof DocumentApiError &&
        (err.code === 'SIGNATURE_REQUEST_NOT_FOUND' ||
          err.code === 'SIGNATURE_REQUEST_NOT_CANCELLABLE' ||
          err.message.toLowerCase().includes('not found'))
      ) {
        toast.message('Esta solicitação já não está mais disponível. Atualizando lista…');
        await refetch();
        await invalidateSignatureQueries(queryClient, tenant?.tenantId ?? user?.companyId);
        return;
      }
      setError(err instanceof Error ? err.message : 'Falha ao revogar solicitação.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <WorkspaceSideDrawer
      title="Assinaturas do documento"
      onClose={onClose}
      testId="document-signatures-drawer"
      overlayTestId="document-signatures-drawer-overlay"
      closeTestId="document-signatures-drawer-close"
      closeAriaLabel="Fechar painel de assinaturas"
      zIndexClass="z-[90]"
      bodyClassName="py-4"
    >
      <div className="mb-4 border-b border-doqyn-border-subtle pb-3">
        <TruncatedText className="text-label text-doqyn-text">{documentName}</TruncatedText>
        {summaryLabel ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={signatureSummaryBadgeVariant(document.signatureSummary!.status)}>
              {summaryLabel}
            </Badge>
          </div>
        ) : null}
      </div>

      {isLoading ? <p className="text-caption text-doqyn-muted">Carregando assinaturas…</p> : null}
      {isError ? (
        <div className="space-y-2">
          <p className="text-caption text-doqyn-danger">
            Não foi possível carregar as assinaturas.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {error ? <p className="mb-3 text-caption text-doqyn-danger">{error}</p> : null}

      <div className={cn('space-y-3')}>
        {data?.items.map((entry) => (
          <SignatureRequestCard
            key={entry.signatureRequestId}
            entry={entry}
            onDownloadSigned={(requestId, verificationCode) =>
              void handleDownloadSigned(requestId, verificationCode)
            }
            onDownloadEvidence={(requestId) => void handleDownloadEvidence(requestId)}
            onRevoke={(item) => void handleRevoke(item)}
            downloadingSigned={downloadingSigned}
            downloadingEvidence={downloadingEvidence}
            revokingId={revokingId}
          />
        ))}
      </div>

      {!isLoading && !isError && data?.items.length === 0 ? (
        <p className="text-caption text-doqyn-muted">Nenhuma assinatura solicitada.</p>
      ) : null}
    </WorkspaceSideDrawer>
  );
}
