import { usesDoqynAuth, getAuthBasePath } from '@/auth/authConfig';
import {
  buildPublicAccessRequestBody,
  type PublicAccessRequestInput,
} from '../buildAccessRequestBody';

export type { PublicAccessRequestInput };

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

  const body = buildPublicAccessRequestBody(input, usesDoqynAuth() ? 'doqyn_auth' : 'legacy');

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
