import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { fetchPublicSignatureVerification } from '@/features/signature/api/signatureApi';
import {
  GuestPortalShell,
  GuestRegisterRow,
  GuestSeal,
} from '@/features/guest-portal/GuestPortalShell';
import { formatDate } from '@/i18n/formats';
import { useTranslation } from 'react-i18next';

type VerificationResult = {
  valid: boolean;
  status: string;
  verificationCode: string;
  signerNameMasked: string;
  signerEmailMasked: string;
  signedAt: string;
  originalDocumentHashSha256: string;
  signedPdfHashSha256: string;
  integrityStatus: string;
  method: string;
};

function formatDateTime(iso: string): string {
  return formatDate(iso, { dateStyle: 'short', timeStyle: 'short' }) || iso;
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="verify-hash">
      <p className="register-label text-doqyn-subtle">{label}</p>
      <p className="verify-hash__value">{value}</p>
    </div>
  );
}

/**
 * Atestado público: quem chega aqui veio do QR ou do código impresso no certificado e
 * quer uma resposta só — esta assinatura vale? A resposta é a primeira coisa da página;
 * o resto é a prova, em registro.
 */
export function SignatureVerificationPage() {
  const { t } = useTranslation('signature');

  const { verificationCode = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPublicSignatureVerification(verificationCode);
        if (!cancelled) setResult(data as VerificationResult);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('signatureVerificationPage.unavailable'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verificationCode, t]);

  if (loading) {
    return (
      <GuestPortalShell subtitle={t('signatureVerificationPage.subtitle')}>
        <div className="guest-state" data-testid="signature-verification">
          <Icon
            name="progress_activity"
            size={ICON_SIZE.md}
            className="animate-spin text-doqyn-muted"
          />
          <p className="type-caption text-doqyn-subtle">
            {t('signatureVerificationPage.conferindoOCodigo')}
          </p>
        </div>
      </GuestPortalShell>
    );
  }

  if (error || !result) {
    return (
      <GuestPortalShell
        subtitle={t('signatureVerificationPage.subtitle')}
        footNote={t('signatureVerificationPage.footNote')}
      >
        <section className="guest-card guest-card--narrow" data-testid="signature-verification">
          <p className="register-label text-doqyn-subtle">
            {t('signatureVerificationPage.codigoNaoConfere')}
          </p>
          <h1 className="guest-title">{t('signatureVerificationPage.nenhumaAssinaturaComEste')}</h1>
          <p className="type-body mt-3 text-doqyn-muted">
            {error ?? t('signatureVerificationPage.notFound')}
          </p>
          {verificationCode ? <p className="verify-code mt-6">{verificationCode}</p> : null}
          <p className="type-caption mt-6 text-doqyn-subtle">
            {t('signatureVerificationPage.confiraOCodigoImpresso')}
          </p>
        </section>
      </GuestPortalShell>
    );
  }

  const valid = result.valid && result.integrityStatus === 'ok';

  return (
    <GuestPortalShell
      subtitle={t('signatureVerificationPage.subtitle')}
      headerAside={
        <GuestSeal>
          {valid
            ? t('signatureVerificationPage.sealValid')
            : t('signatureVerificationPage.sealInvalid')}
        </GuestSeal>
      }
      footNote={t('signatureVerificationPage.footNote')}
    >
      <section className="guest-card" data-testid="signature-verification">
        <p className="register-label text-doqyn-subtle">
          {t('signatureVerificationPage.atestadoDeAssinaturaEletronica')}
        </p>

        <div className="verify-verdict" data-valid={valid}>
          <Icon name={valid ? 'verified' : 'gpp_maybe'} size={28} aria-hidden />
          <div className="min-w-0">
            <h1 className="guest-title">
              {valid
                ? t('signatureVerificationPage.verdictValid')
                : t('signatureVerificationPage.verdictInvalid')}
            </h1>
            <p className="type-body mt-1 text-doqyn-muted">
              {valid
                ? t('signatureVerificationPage.signedByAt', {
                    signer: result.signerNameMasked,
                    date: formatDateTime(result.signedAt),
                  })
                : t('signatureVerificationPage.invalidatedDetail')}
            </p>
          </div>
        </div>

        <p className="verify-code">{result.verificationCode}</p>

        <dl className="guest-register">
          <GuestRegisterRow
            label={t('signatureVerificationPage.signatario')}
            value={result.signerNameMasked}
          />
          <GuestRegisterRow
            label={t('signatureVerificationPage.eMail')}
            value={result.signerEmailMasked}
          />
          <GuestRegisterRow
            label={t('signatureVerificationPage.assinadoEm')}
            value={formatDateTime(result.signedAt)}
          />
          <GuestRegisterRow label={t('signatureVerificationPage.metodo')} value={result.method} />
          <GuestRegisterRow
            label={t('signatureVerificationPage.integridade')}
            value={
              result.integrityStatus === 'ok'
                ? t('signatureVerificationPage.integrityOk')
                : t('signatureVerificationPage.integrityInvalid')
            }
            tone={result.integrityStatus === 'ok' ? 'default' : 'warning'}
          />
        </dl>

        <div className="verify-hashes">
          <p className="type-caption text-doqyn-subtle">
            {t('signatureVerificationPage.asImpressoesDigitaisAbaixo')}
          </p>
          <HashRow
            label={t('signatureVerificationPage.sha256DoOriginal')}
            value={result.originalDocumentHashSha256}
          />
          <HashRow
            label={t('signatureVerificationPage.sha256DoAssinado')}
            value={result.signedPdfHashSha256}
          />
        </div>
      </section>
    </GuestPortalShell>
  );
}
