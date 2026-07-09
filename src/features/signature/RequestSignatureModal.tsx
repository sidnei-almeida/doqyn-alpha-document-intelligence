import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createDocumentSignatureRequest } from '@/features/signature/api/signatureApi';

type RequestSignatureModalProps = {
  open: boolean;
  documentId: string | null;
  onClose: () => void;
};

export function RequestSignatureModal({ open, documentId, onClose }: RequestSignatureModalProps) {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [message, setMessage] = useState('');
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open || !documentId) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = (await createDocumentSignatureRequest(documentId, {
        signerName,
        signerEmail,
        signerPhone: signerPhone || undefined,
        message: message || undefined,
        permissions: { canDownloadAfterSign: true },
      })) as { request?: { portalUrl?: string } };
      setPortalUrl(result.request?.portalUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="request-signature-modal">
      <div className="w-full max-w-lg rounded-lg border border-doqyn-border bg-doqyn-surface p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Solicitar assinatura eletrônica</h2>
        {portalUrl ? (
          <div className="space-y-3 text-sm">
            <p>Solicitação criada. Compartilhe o link com o signatário:</p>
            <code className="block break-all rounded bg-doqyn-bg p-2">{portalUrl}</code>
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              className="w-full rounded border border-doqyn-border bg-doqyn-bg px-3 py-2"
              placeholder="Nome do signatário"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
            <input
              className="w-full rounded border border-doqyn-border bg-doqyn-bg px-3 py-2"
              placeholder="E-mail"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
            />
            <input
              className="w-full rounded border border-doqyn-border bg-doqyn-bg px-3 py-2"
              placeholder="Telefone/WhatsApp (opcional)"
              value={signerPhone}
              onChange={(e) => setSignerPhone(e.target.value)}
            />
            <textarea
              className="w-full rounded border border-doqyn-border bg-doqyn-bg px-3 py-2"
              placeholder="Mensagem (opcional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
                Criar solicitação
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
