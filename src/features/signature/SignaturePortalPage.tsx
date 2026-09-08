import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
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
import {
  GuestPortalShell,
  GuestRegisterRow,
  GuestSeal,
} from '@/features/guest-portal/GuestPortalShell';
import { useTranslation } from 'react-i18next';

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; manifest: DocumentPreviewManifest }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PreviewLoadingPanel() {
  const { t } = useTranslation('signature');

  return (
    <div className="sign-sheet sign-sheet--placeholder" data-testid="signature-preview-loading">
      <Icon
        name="progress_activity"
        size={ICON_SIZE.md}
        className="animate-spin text-doqyn-muted"
      />
      <p className="type-caption text-doqyn-subtle">{t('signaturePortalPage.abrindoODocumento')}</p>
    </div>
  );
}

function PreviewUnavailablePanel({ message }: { message: string }) {
  return (
    <div className="sign-sheet sign-sheet--placeholder" data-testid="signature-preview-unavailable">
      <Icon name="draft" size={ICON_SIZE.md} className="text-doqyn-muted" />
      <p className="type-body max-w-sm text-center text-doqyn-muted">{message}</p>
    </div>
  );
}

/** Os três atos da assinatura, sempre visíveis: ler, declarar, assinar. */
function SignSteps({
  read,
  declared,
  signed,
}: {
  read: boolean;
  declared: boolean;
  signed: boolean;
}) {
  const steps = [
    { label: 'Ler o documento', done: read },
    { label: 'Declarar o aceite', done: declared },
    { label: 'Assinar', done: signed },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <ol className="sign-steps">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="sign-steps__item"
          data-state={step.done ? 'done' : index === current ? 'current' : 'todo'}
        >
          <span className="sign-steps__mark" aria-hidden>
            {step.done ? <Icon name="check" size={12} /> : index + 1}
          </span>
          <span className="sign-steps__label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function SignaturePortalPage() {
  const { t } = useTranslation('signature');

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
        imagePath: '/og/portal-card-sign.png',
      };
    }

    const versionSuffix = payload.versionLabel ? ` · ${payload.versionLabel}` : '';
    return {
      title: `Assinar: ${payload.documentName}${versionSuffix} · DOQYN`,
      description: `${payload.issuerName} solicitou sua assinatura neste documento.`,
      // Ver a nota do portal de compartilhamento: o cartão é de marca, o documento não sai daqui.
      imagePath: '/og/portal-card-sign.png',
    };
  }, [payload]);

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
    return formatDateTime(payload.expiresAt);
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
      <GuestPortalShell subtitle="Assinatura eletrônica">
        <div className="guest-state" data-testid="signature-portal">
          <Icon
            name="progress_activity"
            size={ICON_SIZE.md}
            className="animate-spin text-doqyn-muted"
          />
          <p className="type-caption text-doqyn-subtle">
            {t('signaturePortalPage.abrindoASolicitacao')}
          </p>
        </div>
      </GuestPortalShell>
    );
  }

  if (error && !payload) {
    return (
      <GuestPortalShell subtitle="Assinatura eletrônica">
        <section className="guest-card guest-card--narrow" data-testid="signature-portal">
          <p className="register-label text-doqyn-subtle">
            {t('signaturePortalPage.solicitacaoIndisponivel')}
          </p>
          <h1 className="guest-title">{t('signaturePortalPage.esteLinkNaoAbre')}</h1>
          <p className="type-body mt-3 text-doqyn-muted">{error}</p>
          <p className="type-caption mt-6 text-doqyn-subtle">
            {t('signaturePortalPage.pecaUmaNovaSolicitacao')}
          </p>
        </section>
      </GuestPortalShell>
    );
  }

  if (completed) {
    return (
      <GuestPortalShell
        subtitle="Assinatura eletrônica"
        headerAside={<GuestSeal>{t('signaturePortalPage.assinado')}</GuestSeal>}
        footNote="A assinatura fica registrada com data, hora e evidências técnicas de auditoria."
      >
        <section className="guest-card guest-card--narrow" data-testid="signature-portal-success">
          <p className="register-label text-doqyn-subtle">
            {t('signaturePortalPage.assinaturaConcluida')}
          </p>
          <h1 className="guest-title">{t('signaturePortalPage.documentoAssinado')}</h1>
          <p className="type-body mt-3 text-doqyn-muted">
            {t('signaturePortalPage.signedByLine', {
              document: payload?.documentName ?? '',
              signer: payload?.signer.name ?? '',
            })}
          </p>

          {verificationCode ? (
            <div className="sign-seal">
              <p className="register-label text-doqyn-subtle">
                {t('signaturePortalPage.codigoDeVerificacao')}
              </p>
              <p className="sign-seal__code">{verificationCode}</p>
              <Link
                to={`/verify/signature/${encodeURIComponent(verificationCode)}`}
                className="type-caption text-doqyn-primary hover:underline"
                data-testid="signature-verification-link"
              >
                {t('signaturePortalPage.validarEstaAssinatura')}
              </Link>
            </div>
          ) : null}

          {payload?.permissions.canDownloadAfterSign ? (
            <div className="guest-actions">
              <Button
                type="button"
                disabled={downloading}
                onClick={() => void handleDownloadSigned()}
                data-testid="signature-download-signed"
              >
                {downloading ? 'Baixando…' : 'Baixar PDF assinado'}
              </Button>
            </div>
          ) : null}
        </section>
      </GuestPortalShell>
    );
  }

  return (
    <>
      <GuestPortalShell
        subtitle="Assinatura eletrônica"
        layout="work"
        headerAside={
          <>
            <p className="type-caption text-doqyn-muted">
              {t('signaturePortalPage.solicitadoPor')}{' '}
              <span className="text-doqyn-text">{payload?.issuerName}</span>
            </p>
            <GuestSeal>{t('signaturePortalPage.assinaturaPendente')}</GuestSeal>
          </>
        }
        footNote="Ao assinar, seu aceite é registrado com data, hora e evidências técnicas de auditoria."
      >
        <div className="sign-layout" data-testid="signature-portal">
          <section className="sign-layout__sheet">
            {preview.kind === 'loading' ? <PreviewLoadingPanel /> : null}
            {preview.kind === 'ready' && payload ? (
              <div className="h-full" data-testid="signature-preview-ready">
                <GuestSignatureViewer manifest={preview.manifest} payload={payload} />
                <p className="sr-only" data-testid="signature-document-loaded">
                  {t('signaturePortalPage.documentoCarregado')}
                </p>
              </div>
            ) : null}
            {preview.kind === 'unavailable' ? (
              <PreviewUnavailablePanel message={preview.message} />
            ) : null}
            {preview.kind === 'error' ? (
              <PreviewUnavailablePanel
                message={`${preview.message} Você ainda pode assinar depois de declarar o aceite.`}
              />
            ) : null}
          </section>

          <aside className="sign-rail">
            <div className="sign-rail__block">
              <p className="register-label text-doqyn-subtle">
                {t('signaturePortalPage.oQueVoceVai')}
              </p>
              <TruncatedText as="h2" className="guest-title guest-title--sm mt-1.5">
                {payload?.documentName ?? 'Documento'}
              </TruncatedText>
              <dl className="guest-register">
                {payload?.versionLabel ? (
                  <GuestRegisterRow
                    label={t('signaturePortalPage.versao')}
                    value={payload.versionLabel}
                  />
                ) : null}
                <GuestRegisterRow
                  label={t('signaturePortalPage.signatario')}
                  value={payload?.signer.name ?? '—'}
                />
                <GuestRegisterRow
                  label={t('signaturePortalPage.eMail')}
                  value={payload?.signer.emailMasked ?? '—'}
                />
                {expiresLabel ? (
                  <GuestRegisterRow
                    label={t('signaturePortalPage.assineAte')}
                    value={expiresLabel}
                    tone="warning"
                  />
                ) : null}
              </dl>
              {payload?.isVersionStale && payload.versionLabel ? (
                <p className="type-caption mt-3 text-doqyn-warning">
                  {t('signaturePortalPage.aSolicitacaoEDa')} {payload.versionLabel}
                  {t('signaturePortalPage.oDocumentoJaTem')}
                </p>
              ) : null}
              {payload?.message ? (
                <blockquote className="guest-quote">{payload.message}</blockquote>
              ) : null}
            </div>

            <div className="sign-rail__block">
              <SignSteps read={previewAttempted} declared={consentAccepted} signed={false} />
              <Checkbox
                wrapperClassName="mt-4"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                data-testid="signature-consent-checkbox"
                label={<span className="type-caption leading-relaxed">{payload?.consentText}</span>}
              />
            </div>

            <div className="sign-rail__block sign-rail__block--flush">
              <p className="register-label text-doqyn-subtle">
                {t('signaturePortalPage.aoAssinar')}
              </p>
              <ul className="sign-facts">
                <li>{t('signaturePortalPage.oPdfRecebeO')}</li>
                <li>{t('signaturePortalPage.dataHoraEEvidencias')}</li>
                <li>
                  {payload?.permissions.canDownloadAfterSign
                    ? 'Você poderá baixar o PDF assinado nesta mesma tela.'
                    : 'O documento assinado fica com quem solicitou a assinatura.'}
                </li>
              </ul>
            </div>

            {error ? <p className="type-caption text-doqyn-danger">{error}</p> : null}

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
              className="w-full"
              data-testid="signature-submit-button"
            >
              {t('signaturePortalPage.assinarDocumento')}
            </Button>
          </aside>
        </div>
      </GuestPortalShell>

      <ReviewBeforeSubmitDialog
        open={confirmOpen}
        title={t('signaturePortalPage.confirmarAssinatura')}
        description={t('signaturePortalPage.reviseOsDadosAntes')}
        sections={[
          {
            title: 'Documento',
            fields: [
              { label: 'Nome', value: payload?.documentName ?? '' },
              { label: 'Versão', value: payload?.versionLabel ?? '—' },
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
        confirmLabel={t('signaturePortalPage.confirmarAssinatura2')}
        cancelLabel={t('signaturePortalPage.voltar')}
        onCancel={() => setConfirmOpen(false)}
        onEdit={() => setConfirmOpen(false)}
        onConfirm={() => void handleSign()}
      />
    </>
  );
}
