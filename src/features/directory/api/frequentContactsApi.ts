import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type FrequentContact = {
  userId: string;
  name: string;
  email?: string;
  /**
   * O apelido, quando houver de onde tirá-lo — hoje nunca vem preenchido.
   *
   * Ver `ContactAffinity` no servidor: a fonte que parecia servir guarda o e-mail. O cartão
   * simplesmente omite a linha, em vez de mostrar um handle que manda procurar por quem não
   * existe.
   */
  username?: string;
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
