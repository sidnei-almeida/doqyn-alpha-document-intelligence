import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicSignatureVerification } from '@/features/signature/api/signatureApi';

export function SignatureVerificationPage() {
  const { verificationCode = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPublicSignatureVerification(verificationCode);
        if (!cancelled) setResult(data as Record<string, unknown>);
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
    return <div className="flex min-h-screen items-center justify-center bg-doqyn-bg p-6">Validando…</div>;
  }

  if (error || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg p-6 text-doqyn-text" data-testid="signature-verification">
        {error ?? 'Assinatura não encontrada.'}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-doqyn-bg p-6 text-doqyn-text" data-testid="signature-verification">
      <h1 className="text-xl font-semibold">Validação de assinatura eletrônica DOQYN</h1>
      <p>Status: {String(result.status)}</p>
      <p>Integridade: {String(result.integrityStatus)}</p>
      <p>Signatário: {String(result.signerNameMasked)}</p>
      <p>E-mail: {String(result.signerEmailMasked)}</p>
      <p>Assinado em: {String(result.signedAt)}</p>
      <p className="break-all text-sm">Hash original: {String(result.originalDocumentHashSha256)}</p>
      <p className="break-all text-sm">Hash assinado: {String(result.signedPdfHashSha256)}</p>
      <p className="text-sm text-doqyn-text-muted">Método: {String(result.method)}</p>
    </div>
  );
}
