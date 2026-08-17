import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { DoqynLogo } from '@/components/brand';
import { Badge } from '@/components/ui/Badge';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { ReviewBeforeSubmitDialog } from '@/components/ui/ReviewBeforeSubmitDialog';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import {
  downloadSignedPdfViaToken,
  fetchSignaturePortal,
  fetchSignaturePreviewManifest,
  signDocumentViaPortal,
  type SignaturePortalPayload,
} from '@/features/signature/api/signatureApi';
import { GuestSignatureViewer } from '@/features/signature/GuestSignatureViewer';
import { invalidateSignatureQueries } from '@/features/signature/utils/invalidateSignatureQueries';
import { publishSignatureCompleted } from '@/features/signature/utils/signatureCompletionSync';
import { useGuestPortalPageMeta } from '@/features/guest-portal/useGuestPortalPageMeta';

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
      data-testid="signature-preview-loading"
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
      className="flex h-[min(70vh,720px)] flex-col items-center justify-center gap-3 rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg/40 p-8 text-center"
      data-testid="signature-preview-unavailable"
    >
      <Icon name="visibility_off" size={ICON_SIZE.md} className="text-doqyn-warning" />
      <p className="text-sm font-medium text-doqyn-text">
        Preview indisponível para este documento.
      </p>
      <p className="max-w-md text-sm leading-relaxed text-doqyn-subtle">{message}</p>
    </div>
  );
}

export function SignaturePortalPage() {
  const { token = '' } = useParams();
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SignaturePortalPayload | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'loading' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const pageMeta = useMemo(() => {
    if (!payload) {
      return {
        title: 'Assinatura · DOQYN',
        description: 'Assine documentos com segurança e rastreabilidade no DOQYN.',
        imagePath: '/og/portal-default.webp',
      };
    }

    const versionSuffix = payload.versionLabel ? ` · ${payload.versionLabel}` : '';
    return {
      title: `Assinar: ${payload.documentName}${versionSuffix} · DOQYN`,
      description: `${payload.issuerName} solicitou sua assinatura neste documento.`,
      imagePath: `/api/og/guest/sign/${encodeURIComponent(token)}/image`,
    };
  }, [payload, token]);

  useGuestPortalPageMeta(pageMeta);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPreview({ kind: 'loading' });

      try {
        const data = await fetchSignaturePortal(token);
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
          const manifest = (await fetchSignaturePreviewManifest(token)) as DocumentPreviewManifest;
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
          setError(err instanceof Error ? err.message : 'Convite inválido.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    if (!canSubmit) return;
    setSigning(true);
    setError(null);
    try {
      const result = await signDocumentViaPortal(token, true);
      if (payload) {
        publishSignatureCompleted({
          documentId: payload.documentId,
          signatureRequestId: payload.signatureRequestId,
        });
        if (user?.id) {
          await invalidateSignatureQueries(queryClient, tenant?.tenantId ?? user.companyId);
        }
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
    if (!token || !payload?.permissions.canDownloadAfterSign) return;
    setDownloading(true);
    try {
      const blob = await downloadSignedPdfViaToken(token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.documentName || 'documento-assinado.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar PDF assinado.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-doqyn-bg text-doqyn-text"
        data-testid="signature-portal"
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
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-doqyn-bg p-6 text-doqyn-text"
        data-testid="signature-portal"
      >
        <DoqynLogo size="sm" variant="horizontal" subtitle="Assinatura eletrônica" />
        <div className="max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface p-8 text-center">
          <Icon name="link_off" size={ICON_SIZE.md} className="mx-auto text-doqyn-muted" />
          <h1 className="mt-4 text-base font-semibold">Assinatura indisponível</h1>
          <p className="mt-2 text-sm text-doqyn-subtle">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 bg-doqyn-bg p-6 text-doqyn-text"
        data-testid="signature-portal-success"
      >
        <DoqynLogo size="sm" variant="horizontal" subtitle="Assinatura eletrônica" />
        <div className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-doqyn-success-bg text-doqyn-success">
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
              data-testid="signature-verification-link"
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
              data-testid="signature-download-signed"
            >
              {downloading ? 'Baixando…' : 'Baixar PDF assinado'}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-doqyn-bg text-doqyn-text"
      data-testid="signature-portal"
    >
      <header className="shrink-0 border-b border-doqyn-border bg-doqyn-bg px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <DoqynLogo size="sm" variant="horizontal" subtitle="Assinatura eletrônica" />
          <div className="flex items-center gap-3">
            <p className="text-caption text-doqyn-muted">
              Solicitado por <span className="text-doqyn-text">{payload?.issuerName}</span>
            </p>
            <Badge variant="pending">Assinatura pendente</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        <section className="min-w-0 flex-1 lg:min-h-0">
          {preview.kind === 'loading' ? <PreviewLoadingPanel /> : null}
          {preview.kind === 'ready' && payload ? (
            <div className="lg:h-full" data-testid="signature-preview-ready">
              <GuestSignatureViewer manifest={preview.manifest} payload={payload} />
              <p className="sr-only" data-testid="signature-document-loaded">
                Documento carregado
              </p>
            </div>
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

        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <section className="rounded-xl border border-doqyn-border bg-doqyn-surface p-4 sm:p-5">
            <TruncatedText as="h2" className="text-base font-semibold">
              {payload?.documentName ?? 'Documento'}
            </TruncatedText>
            <div className="mt-2 flex flex-wrap gap-2">
              {payload?.versionLabel ? (
                <VersionBadge version={payload.versionLabel} isCurrent size="sm" />
              ) : null}
              {payload?.isVersionStale ? (
                <Badge variant="warning">Versão da solicitação</Badge>
              ) : null}
            </div>
            {payload?.isVersionStale && payload.versionLabel ? (
              <p className="mt-3 text-xs leading-relaxed text-doqyn-warning">
                Esta solicitação se refere à versão v{payload.versionLabel} deste documento.
              </p>
            ) : null}

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-doqyn-muted">Signatário</dt>
                <dd>{payload?.signer.name}</dd>
                <dd className="text-doqyn-subtle">{payload?.signer.emailMasked}</dd>
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
            <p className="text-label text-doqyn-text">Leia o documento antes de assinar.</p>
            <Checkbox
              wrapperClassName="mt-4"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              data-testid="signature-consent-checkbox"
              label={<span className="text-caption leading-relaxed">{payload?.consentText}</span>}
            />
          </section>

          {error ? <p className="text-sm text-doqyn-danger">{error}</p> : null}

          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            className="w-full"
            data-testid="signature-submit-button"
          >
            Assinar documento
          </Button>
        </aside>
      </main>

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
          {
            title: 'Signatário',
            fields: [
              { label: 'Nome', value: payload?.signer.name ?? '' },
              { label: 'E-mail', value: payload?.signer.emailMasked ?? '' },
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
