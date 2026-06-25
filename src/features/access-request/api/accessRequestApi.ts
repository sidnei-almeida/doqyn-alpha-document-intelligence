export type PublicAccessRequestInput = {
  personType: 'individual' | 'business';
  taxId: string;
  tenantDisplayName: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  jobTitle: string;
  departmentText: string;
  reason: string;
  operationalNotificationsConsent: boolean;
};

export type PublicAccessRequestResponse = {
  ok: boolean;
  message: string;
  dev?: {
    memberId: string;
    tenantId: string;
    temporaryPassword?: string;
  };
};

export async function submitAccessRequest(
  input: PublicAccessRequestInput,
): Promise<PublicAccessRequestResponse> {
  const response = await fetch('/api/auth/access-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as PublicAccessRequestResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? 'Não foi possível enviar a solicitação.');
  }

  return data;
}
