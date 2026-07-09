export type SignaturePortalPayload = {
  signatureRequestId: string;
  documentId: string;
  versionId: string;
  documentName: string;
  issuerName: string;
  signer: {
    signerId: string;
    signerType: string;
    name: string;
    emailMasked: string;
    phoneMasked?: string | null;
    organizationName?: string | null;
    status: string;
  };
  permissions: {
    canView: boolean;
    canSign: boolean;
    canDownloadAfterSign: boolean;
  };
  expiresAt: string | null;
  message: string | null;
  consentText: string;
  status: string;
};

export async function fetchSignaturePortal(token: string): Promise<SignaturePortalPayload> {
  const response = await fetch(`/api/sign/${encodeURIComponent(token)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Falha ao carregar convite de assinatura.');
  }
  return response.json() as Promise<SignaturePortalPayload>;
}

export async function signDocumentViaPortal(token: string, consentAccepted: boolean) {
  const response = await fetch(`/api/sign/${encodeURIComponent(token)}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consentAccepted, action: 'sign' }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Falha ao assinar documento.');
  }
  return response.json();
}

export async function createDocumentSignatureRequest(
  documentId: string,
  input: {
    signerName: string;
    signerEmail: string;
    signerPhone?: string;
    signerOrganizationName?: string;
    message?: string;
    expiresAt?: string;
    permissions?: { canDownloadAfterSign?: boolean };
  },
) {
  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/signature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Falha ao criar solicitação de assinatura.');
  }
  return response.json();
}

export async function fetchPublicSignatureVerification(verificationCode: string) {
  const response = await fetch(`/api/verify/signature/${encodeURIComponent(verificationCode)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Assinatura não encontrada.');
  }
  return response.json();
}
