import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type DirectorySearchResult = {
  userId: string;
  username: string;
  name: string;
  email: string;
  /** Ausente quando a pessoa não tem retrato: a linha cai nas iniciais. */
  avatarUrl: string | null;
};

export type DirectorySearchPage = {
  results: DirectorySearchResult[];
  /** O prefixo transbordou o teto do servidor: há mais gente do que a resposta cabe. */
  hasMore: boolean;
};

export async function searchDirectoryUsers(q: string): Promise<DirectorySearchPage> {
  const response = await authFetch(`/api/directory/search?q=${encodeURIComponent(q)}`);
  if (!response.ok) throw await parseDocumentApiError(response);
  const body = (await response.json()) as { results?: DirectorySearchResult[]; hasMore?: boolean };
  return { results: body.results ?? [], hasMore: body.hasMore === true };
}
