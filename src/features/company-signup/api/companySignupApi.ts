import { getAuthBasePath } from '@/auth/authConfig';

export type CompanySignupInput = {
  companyName: string;
  /** ISO 3166-1 alpha-2. Obrigatório: o backend valida documento e telefone por país. */
  country: string;
  /** `cnpj` no Brasil, `tax_id` nos demais países. */
  taxIdType: string;
  taxId: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  acceptedTerms: boolean;
  acceptedTermsVersion: string;
  /** Ver `individualSignupApi.ts`: ausentes no cadastro a partir de sessão existente. */
  email?: string;
  password?: string;
  confirmPassword?: string;
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
