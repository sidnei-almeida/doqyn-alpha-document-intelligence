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
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Validação indisponível.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verificationCode]);

  if (loading) {
    return (
      <GuestPortalShell subtitle="Validação de assinatura">
        <div className="guest-state" data-testid="signature-verification">
          <Icon
            name="progress_activity"
            size={ICON_SIZE.md}
            className="animate-spin text-doqyn-muted"
          />
          <p className="type-caption text-doqyn-subtle">Conferindo o código…</p>
        </div>
      </GuestPortalShell>
    );
  }

  if (error || !result) {
    return (
      <GuestPortalShell
        subtitle="Validação de assinatura"
        footNote="A validação é pública: qualquer pessoa com o código pode conferir a assinatura."
      >
        <section className="guest-card guest-card--narrow" data-testid="signature-verification">
          <p className="register-label text-doqyn-subtle">Código não confere</p>
          <h1 className="guest-title">Nenhuma assinatura com este código</h1>
          <p className="type-body mt-3 text-doqyn-muted">{error ?? 'Assinatura não encontrada.'}</p>
          {verificationCode ? <p className="verify-code mt-6">{verificationCode}</p> : null}
          <p className="type-caption mt-6 text-doqyn-subtle">
            Confira o código impresso no certificado, no fim do documento assinado.
          </p>
        </section>
      </GuestPortalShell>
    );
  }

  const valid = result.valid && result.integrityStatus === 'ok';

  return (
    <GuestPortalShell
      subtitle="Validação de assinatura"
      headerAside={<GuestSeal>{valid ? 'Assinatura válida' : 'Assinatura inválida'}</GuestSeal>}
      footNote="A validação é pública: qualquer pessoa com o código pode conferir a assinatura."
    >
      <section className="guest-card" data-testid="signature-verification">
        <p className="register-label text-doqyn-subtle">Atestado de assinatura eletrônica</p>

        <div className="verify-verdict" data-valid={valid}>
          <Icon name={valid ? 'verified' : 'gpp_maybe'} size={28} aria-hidden />
          <div className="min-w-0">
            <h1 className="guest-title">
              {valid ? 'Esta assinatura é válida' : 'Esta assinatura não está válida'}
            </h1>
            <p className="type-body mt-1 text-doqyn-muted">
              {valid
                ? `Assinada por ${result.signerNameMasked} em ${formatDateTime(result.signedAt)}.`
                : 'O registro existe, mas foi invalidado ou cancelado depois de emitido.'}
            </p>
          </div>
        </div>

        <p className="verify-code">{result.verificationCode}</p>

        <dl className="guest-register">
          <GuestRegisterRow label="Signatário" value={result.signerNameMasked} />
          <GuestRegisterRow label="E-mail" value={result.signerEmailMasked} />
          <GuestRegisterRow label="Assinado em" value={formatDateTime(result.signedAt)} />
          <GuestRegisterRow label="Método" value={result.method} />
          <GuestRegisterRow
            label="Integridade"
            value={result.integrityStatus === 'ok' ? 'Conferida' : 'Invalidada'}
            tone={result.integrityStatus === 'ok' ? 'default' : 'warning'}
          />
        </dl>

        <div className="verify-hashes">
          <p className="type-caption text-doqyn-subtle">
            As impressões digitais abaixo identificam o arquivo. Confira-as contra o documento que
            você tem em mãos para saber se é exatamente o mesmo que foi assinado.
          </p>
          <HashRow label="SHA-256 do original" value={result.originalDocumentHashSha256} />
          <HashRow label="SHA-256 do assinado" value={result.signedPdfHashSha256} />
        </div>
      </section>
    </GuestPortalShell>
  );
}
