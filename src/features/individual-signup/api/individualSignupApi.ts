import { getAuthBasePath } from '@/auth/authConfig';

export type IndividualSignupInput = {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  /** ISO 3166-1 alpha-2 (ex.: BR, PY, US, ES) — país de domicílio/documento fiscal do usuário. */
  country: string;
  /** Tipo de documento fiscal (ex.: cpf, ci, ssn, nif, tax_id) — vem de getIdentifierSpec(country, 'individual').code. */
  taxIdType: string;
  taxId: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  acceptedTermsVersion: string;
};

export type IndividualSignupResponse = {
  ok: boolean;
  message?: string;
  code?: string;
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
    throw new Error(data.message ?? 'Não foi possível criar seu acesso.');
  }

  return data;
}
