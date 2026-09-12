import { getAuthBasePath } from '@/auth/authConfig';
import { parseApiError } from '@/lib/apiErrors';
import { i18n } from '@/i18n';

export type IndividualSignupInput = {
  firstName: string;
  lastName: string;
  /** Apelido escolhido no cadastro. Vazio, o servidor deriva um do e-mail. */
  username?: string;
  /** ISO 3166-1 alpha-2. Obrigatório: o backend valida documento e telefone por país. */
  country: string;
  /** `cpf` no Brasil, `tax_id` nos demais países. */
  taxIdType: string;
  whatsapp: string;
  taxId: string;
  acceptedTerms: boolean;
  acceptedTermsVersion: string;
  /**
   * Ausentes quando o cadastro parte de uma sessão que já existe (login social sem espaço de
   * trabalho): nesse caso a identidade vem da sessão e não há senha a definir.
   */
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export type IndividualSignupResponse = {
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

export async function submitIndividualSignup(
  input: IndividualSignupInput,
): Promise<IndividualSignupResponse> {
  const response = await fetch(`${getAuthBasePath()}/individual-signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as IndividualSignupResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw await parseApiError(response, i18n.t('auth:individualSignupPage.apiFailed'));
  }

  return data;
}
