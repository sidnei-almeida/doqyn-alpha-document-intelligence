import { usesDoqynAuth, getAuthBasePath } from '@/auth/authConfig';

export type PublicAccessRequestInput = {
  personType: 'individual' | 'business';
  taxId: string;
  tenantDisplayName?: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  password?: string;
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
  const url = usesDoqynAuth() ? `${getAuthBasePath()}/access-requests` : '/api/auth/access-requests';

  const body = usesDoqynAuth()
    ? {
        personType: input.personType,
        taxId: input.taxId,
        tenantDisplayName: input.tenantDisplayName,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        whatsapp: input.whatsapp,
        password: input.password ?? '',
        jobTitle: input.jobTitle,
        departmentText: input.departmentText,
        reason: input.reason,
        operationalNotificationsConsent: input.operationalNotificationsConsent,
      }
    : input;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: usesDoqynAuth() ? 'include' : 'same-origin',
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as PublicAccessRequestResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? 'Não foi possível enviar a solicitação.');
  }

  return data;
}
