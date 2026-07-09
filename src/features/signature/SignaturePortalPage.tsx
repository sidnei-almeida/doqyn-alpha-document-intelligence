import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { fetchSignaturePortal, signDocumentViaPortal } from '@/features/signature/api/signatureApi';

export function SignaturePortalPage() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof fetchSignaturePortal>> | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchSignaturePortal(token);
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Convite inválido.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSign = async () => {
    if (!consentAccepted) return;
    setSigning(true);
    setError(null);
    try {
      const result = (await signDocumentViaPortal(token, true)) as { verificationCode?: string };
      setVerificationCode(result.verificationCode ?? null);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao assinar.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-doqyn-text" data-testid="signature-portal">
        Carregando assinatura…
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg p-6 text-doqyn-text" data-testid="signature-portal">
        {error}
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-doqyn-bg p-6 text-doqyn-text" data-testid="signature-portal-success">
        <h1 className="text-xl font-semibold">Documento assinado com sucesso</h1>
        {verificationCode ? (
          <p className="text-sm text-doqyn-text-muted">Código de verificação: {verificationCode}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-doqyn-bg text-doqyn-text" data-testid="signature-portal">
      <header className="border-b border-doqyn-border px-6 py-4">
        <div className="text-sm text-doqyn-text-muted">Assinatura eletrônica DOQYN</div>
        <h1 className="text-lg font-semibold">{payload?.documentName}</h1>
        <p className="text-sm text-doqyn-text-muted">Solicitado por {payload?.issuerName}</p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
        <section className="rounded-lg border border-doqyn-border bg-doqyn-surface p-4">
          <h2 className="mb-2 font-medium">Signatário</h2>
          <p>{payload?.signer.name}</p>
          <p className="text-sm text-doqyn-text-muted">{payload?.signer.emailMasked}</p>
        </section>

        <section className="rounded-lg border border-doqyn-border bg-doqyn-surface p-4">
          <p className="text-sm leading-relaxed">{payload?.consentText}</p>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              data-testid="signature-consent-checkbox"
            />
            <span>Li e concordo com os termos acima.</span>
          </label>
        </section>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <Button
          type="button"
          disabled={!consentAccepted || signing}
          onClick={() => void handleSign()}
          data-testid="signature-submit-button"
        >
          {signing ? 'Assinando…' : 'Assinar documento'}
        </Button>
      </main>
    </div>
  );
}
