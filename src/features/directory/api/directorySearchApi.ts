import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type DirectorySearchResult = {
  userId: string;
  username: string;
  name: string;
};

export async function searchDirectoryUsers(q: string): Promise<DirectorySearchResult[]> {
  const response = await authFetch(`/api/directory/search?q=${encodeURIComponent(q)}`);
  if (!response.ok) throw await parseDocumentApiError(response);
  const body = (await response.json()) as { results?: DirectorySearchResult[] };
  return body.results ?? [];
}
