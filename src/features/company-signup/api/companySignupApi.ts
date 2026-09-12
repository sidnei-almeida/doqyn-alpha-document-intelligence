import { getAuthBasePath } from '@/auth/authConfig';
import { parseApiError } from '@/lib/apiErrors';
import { i18n } from '@/i18n';

export type CompanySignupInput = {
  companyName: string;
  /** ISO 3166-1 alpha-2. Obrigatório: o backend valida documento e telefone por país. */
  country: string;
  /** `cnpj` no Brasil, `tax_id` nos demais países. */
  taxIdType: string;
  taxId: string;
  firstName: string;
  lastName: string;
  /** Apelido escolhido no cadastro. Vazio, o servidor deriva um do e-mail. */
  username?: string;
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
  /**
   * A conta foi criada, mas o acesso só abre depois do código do e-mail — e por isso não veio
   * cookie de sessão nesta resposta. Ver `signupOrchestrator.ts` no auth-service.
   */
  emailVerificationRequired?: boolean;
  verificationTicket?: string;
};

export async function submitCompanySignup(
  input: CompanySignupInput,
): Promise<CompanySignupResponse> {
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
    throw await parseApiError(response, i18n.t('auth:companySignupPage.apiFailed'));
  }

  return data;
}
