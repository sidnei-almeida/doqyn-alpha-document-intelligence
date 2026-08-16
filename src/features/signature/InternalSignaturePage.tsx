import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { Badge } from '@/components/ui/Badge';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import {
  downloadSignatureRequestSignedPdf,
  fetchInternalSignaturePreviewManifest,
  fetchInternalSignatureSigningPayload,
  signDocumentViaRequest,
  type InternalSignatureSigningPayload,
} from '@/features/signature/api/signatureApi';
import { InternalSignatureViewer } from '@/features/signature/InternalSignatureViewer';
import { triggerBlobDownload } from '@/features/library/api/libraryApi';
import { invalidateSignatureQueries } from '@/features/signature/utils/invalidateSignatureQueries';
import { publishSignatureCompleted } from '@/features/signature/utils/signatureCompletionSync';

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; manifest: DocumentPreviewManifest }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PreviewLoadingPanel() {
  return (
    <div
      className="flex h-[min(70vh,720px)] flex-col items-center justify-center gap-3 rounded-lg border border-doqyn-border bg-doqyn-surface"
      data-testid="internal-signature-preview-loading"
    >
      <Icon
        name="progress_activity"
        size={ICON_SIZE.md}
        className="animate-spin text-doqyn-muted"
      />
      <p className="text-sm text-doqyn-subtle">Carregando documento…</p>
    </div>
  );
}

function PreviewUnavailablePanel({ message }: { message: string }) {
  return (
    <div
      className="flex h-[min(70vh,720px)] flex-col items-center justify-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-8 text-center"
      data-testid="internal-signature-preview-unavailable"
    >
      <Icon name="visibility_off" size={ICON_SIZE.md} className="text-amber-600" />
      <p className="text-sm font-medium text-doqyn-text">
        Preview indisponível para este documento.
      </p>
      <p className="max-w-md text-sm leading-relaxed text-doqyn-subtle">{message}</p>
    </div>
  );
}

export function InternalSignaturePage() {
  const { signatureRequestId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InternalSignatureSigningPayload | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'loading' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!signatureRequestId) {
      setError('Solicitação inválida.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPreview({ kind: 'loading' });

      try {
        const data = await fetchInternalSignatureSigningPayload(signatureRequestId);
        if (cancelled) return;
        setPayload(data);

        if (!data.permissions.canView) {
          setPreview({
            kind: 'unavailable',
            message: 'Visualização não permitida para esta solicitação.',
          });
          return;
        }

        try {
          const manifest = (await fetchInternalSignaturePreviewManifest(
            signatureRequestId,
          )) as DocumentPreviewManifest;
          if (cancelled) return;
          if (manifest.status === 'ready' && manifest.viewerType !== 'unsupported') {
            setPreview({ kind: 'ready', manifest });
          } else {
            setPreview({
              kind: 'unavailable',
              message:
                'Não foi possível gerar a visualização deste documento. Você ainda pode prosseguir com a assinatura após ler os dados abaixo.',
            });
          }
        } catch (previewError) {
          if (cancelled) return;
          const message =
            previewError instanceof Error
              ? previewError.message
              : 'Não foi possível carregar o preview do documento.';
          setPreview({ kind: 'error', message });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Solicitação indisponível.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [signatureRequestId]);

  const previewAttempted = preview.kind !== 'loading';
  const canSubmit =
    Boolean(payload?.permissions.canSign) &&
    previewAttempted &&
    consentAccepted &&
    !signing &&
    payload?.status === 'pending';

  const expiresLabel = useMemo(() => {
    if (!payload?.expiresAt) return null;
    return formatDate(payload.expiresAt);
  }, [payload?.expiresAt]);

  const handleSign = async () => {
    if (!canSubmit || !signatureRequestId) return;
    setSigning(true);
    setError(null);
    try {
      const result = await signDocumentViaRequest(signatureRequestId, true);
      if (payload) {
        publishSignatureCompleted({
          documentId: payload.documentId,
          signatureRequestId: payload.signatureRequestId,
        });
        await invalidateSignatureQueries(queryClient, tenant?.tenantId ?? user?.companyId);
      }
      setVerificationCode(result.verificationCode);
      setCompleted(true);
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao assinar.');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadSigned = async () => {
    if (!signatureRequestId || !payload?.permissions.canDownloadAfterSign) return;
    setDownloading(true);
    try {
      const blob = await downloadSignatureRequestSignedPdf(signatureRequestId);
      triggerBlobDownload(blob, payload.documentName || 'documento-assinado.pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar PDF assinado.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        data-testid="internal-signature-page"
      >
        <div className="flex flex-col items-center gap-3">
          <Icon
            name="progress_activity"
            size={ICON_SIZE.md}
            className="animate-spin text-doqyn-muted"
          />
          <p className="text-sm text-doqyn-subtle">Carregando assinatura…</p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center" data-testid="internal-signature-page">
        <Icon name="error" size={ICON_SIZE.md} className="mx-auto text-doqyn-muted" />
        <h1 className="mt-4 text-base font-semibold">Assinatura indisponível</h1>
        <p className="mt-2 text-sm text-doqyn-subtle">{error}</p>
        <Button type="button" className="mt-6" onClick={() => navigate('/biblioteca/assinaturas')}>
          Voltar para Para assinar
        </Button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center" data-testid="internal-signature-success">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Icon name="check_circle" size={ICON_SIZE.md} />
        </div>
        <h1 className="text-lg font-semibold">Documento assinado com sucesso</h1>
        {verificationCode ? (
          <p className="mt-3 text-sm text-doqyn-subtle">
            Código de verificação:{' '}
            <span className="font-mono font-medium text-doqyn-text">{verificationCode}</span>
          </p>
        ) : null}
        {verificationCode ? (
          <Link
            to={`/verify/signature/${encodeURIComponent(verificationCode)}`}
            className="mt-4 inline-block text-sm text-doqyn-accent-active hover:underline"
          >
            Validar assinatura
          </Link>
        ) : null}
        {payload?.permissions.canDownloadAfterSign ? (
          <Button
            type="button"
            className="mt-6 w-full"
            disabled={downloading}
            onClick={() => void handleDownloadSigned()}
          >
            {downloading ? 'Baixando…' : 'Baixar PDF assinado'}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => navigate('/biblioteca/assinaturas')}
        >
          Voltar para Para assinar
        </Button>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:flex-row"
      data-testid="internal-signature-page"
    >
      <section className="min-w-0 flex-1">
        {preview.kind === 'loading' ? <PreviewLoadingPanel /> : null}
        {preview.kind === 'ready' && payload ? (
          <InternalSignatureViewer manifest={preview.manifest} payload={payload} />
        ) : null}
        {preview.kind === 'unavailable' ? (
          <PreviewUnavailablePanel message={preview.message} />
        ) : null}
        {preview.kind === 'error' ? (
          <PreviewUnavailablePanel
            message={`${preview.message} Você ainda pode prosseguir com a assinatura após confirmar o aceite.`}
          />
        ) : null}
      </section>

      <aside className="w-full shrink-0 space-y-4 lg:w-96">
        <section className="rounded-xl border border-doqyn-border bg-doqyn-surface p-4 sm:p-5">
          <TruncatedText as="h2" className="text-base font-semibold">
            {payload?.documentName ?? 'Documento'}
          </TruncatedText>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload?.versionLabel ? (
              <VersionBadge version={payload.versionLabel} isCurrent size="sm" />
            ) : null}
            <Badge variant="pending">Assinatura pendente</Badge>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-doqyn-muted">Solicitado por</dt>
              <dd>{payload?.issuerName}</dd>
            </div>
            {expiresLabel ? (
              <div>
                <dt className="text-doqyn-muted">Expira em</dt>
                <dd className="text-doqyn-warning">{expiresLabel}</dd>
              </div>
            ) : null}
          </dl>

          {payload?.message ? (
            <blockquote className="mt-4 rounded-lg border border-doqyn-border-subtle bg-doqyn-card px-3 py-2 text-sm leading-relaxed">
              {payload.message}
            </blockquote>
          ) : null}
        </section>

        <section className="rounded-xl border border-doqyn-border bg-doqyn-surface p-4 sm:p-5">
          <p className="text-sm font-medium text-doqyn-text">Leia o documento antes de assinar.</p>
          <p className="mt-2 text-xs leading-relaxed text-doqyn-subtle">{payload?.consentText}</p>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              data-testid="internal-signature-consent-checkbox"
              className="mt-0.5"
            />
            <span>{payload?.consentText}</span>
          </label>
        </section>

        {error ? <p className="text-sm text-doqyn-danger">{error}</p> : null}

        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
          className="w-full"
          data-testid="internal-signature-submit-button"
        >
          Assinar documento
        </Button>
      </aside>

      <ReviewBeforeSubmitDialog
        open={confirmOpen}
        title="Confirmar assinatura"
        description="Revise os dados antes de concluir a assinatura eletrônica."
        sections={[
          {
            title: 'Documento',
            fields: [
              { label: 'Nome', value: payload?.documentName ?? '' },
              { label: 'Versão', value: payload?.versionLabel ? `v${payload.versionLabel}` : '—' },
              { label: 'Solicitante', value: payload?.issuerName ?? '' },
            ],
          },
        ]}
        attentionMessage="Esta ação é definitiva. O documento será assinado eletronicamente com registro de auditoria."
        submitting={signing}
        confirmLabel="Confirmar assinatura"
        cancelLabel="Cancelar"
        editLabel="Voltar"
        onCancel={() => setConfirmOpen(false)}
        onEdit={() => setConfirmOpen(false)}
        onConfirm={() => void handleSign()}
      />
    </div>
  );
}
