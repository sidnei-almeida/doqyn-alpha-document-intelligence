import { getAuthBasePath } from '@/auth/authConfig';

export type CompanySignupInput = {
  companyName: string;
  taxId: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  acceptedTermsVersion: string;
};

export type CompanySignupResponse = {
  ok: boolean;
  message?: string;
  code?: string;
};

export async function submitCompanySignup(input: CompanySignupInput): Promise<CompanySignupResponse> {
  const response = await fetch(`${getAuthBasePath()}/company-signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as CompanySignupResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? 'Não foi possível cadastrar a empresa.');
  }

  return data;
}
