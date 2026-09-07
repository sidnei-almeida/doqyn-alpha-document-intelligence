import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

/**
 * Para onde um e-mail digitado aponta.
 *
 * `doqyn_user` existe no contrato desde já, mas o servidor só o devolve quando o envio entre
 * empresas estiver ligado. Até lá ele responde `external`, porque é essa a verdade útil: o link
 * com token é o único caminho para quem está fora, com conta ou sem.
 */
export type DirectoryLookupResult =
  | { kind: 'tenant_member'; user: { userId: string; name: string; email: string } }
  | { kind: 'doqyn_user'; user: { userId: string; name: string } }
  | { kind: 'external' }
  | { kind: 'self' };

export async function lookupDirectoryTarget(email: string): Promise<DirectoryLookupResult> {
  const response = await authFetch(`/api/directory/lookup?email=${encodeURIComponent(email)}`);

  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }

  return response.json() as Promise<DirectoryLookupResult>;
}
