import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type FrequentContact = {
  userId: string;
  name: string;
  email?: string;
  /** O apelido vivo, vindo do auth-service. Ausente quando a conta ainda não tem handle. */
  username?: string;
  /** Decidido à mão: entra na lista mesmo sem troca nenhuma, e vem antes das derivadas. */
  saved?: boolean;
  interactions: number;
  lastInteractionAt: string;
  scope: 'internal' | 'external';
};

export async function fetchFrequentContacts(
  scope: 'internal' | 'external' | 'all' = 'all',
  limit?: number,
): Promise<FrequentContact[]> {
  const params = new URLSearchParams({ scope });
  if (limit) params.set('limit', String(limit));

  const response = await authFetch(`/api/directory/frequent-contacts?${params.toString()}`);
  if (!response.ok) throw await parseDocumentApiError(response);
  const body = (await response.json()) as { contacts?: FrequentContact[] };
  return body.contacts ?? [];
}

/**
 * Salvar alguém como contato, pelo apelido ou pelo e-mail exato.
 *
 * O id nunca sai daqui: é o servidor que resolve o handle contra o diretório, e aceitar id do
 * cliente deixaria salvar qualquer conta cujo identificador se soubesse — inclusive quem se
 * retirou da busca.
 */
export async function saveContact(target: { username?: string; email?: string }): Promise<void> {
  const response = await authFetch('/api/directory/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });
  if (!response.ok) throw await parseDocumentApiError(response);
}

/**
 * Tirar da lista.
 *
 * Não apaga histórico: grava a decisão de não ver mais aquela linha. O que responde auditoria
 * continua onde estava — o que some é o atalho.
 */
export async function hideContact(contactUserId: string): Promise<void> {
  const response = await authFetch(
    `/api/directory/contacts?contactUserId=${encodeURIComponent(contactUserId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw await parseDocumentApiError(response);
}

/** Desfaz a decisão: o contato volta a valer o que o histórico disser sobre ele. */
export async function forgetContactDecision(contactUserId: string): Promise<void> {
  const response = await authFetch(
    `/api/directory/contacts?contactUserId=${encodeURIComponent(contactUserId)}&undo=true`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw await parseDocumentApiError(response);
}
