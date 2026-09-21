import { getDoqynAuthBaseUrl, getDoqynAuthInternalApiKey } from '../auth/authConfig.js';
import type { AuthTenantMemberSyncSnapshot } from './authTenantMemberTypes.js';
import { ServiceError } from '../utils/serviceErrors.js';

type InternalAvatarMetadata = {
  storageProvider: string | null;
  objectKey: string | null;
  contentType: string | null;
  version: number;
  status: string | null;
};

type InternalAvatarUpdateInput = {
  storageProvider?: 'r2' | 'local' | null;
  objectKey?: string | null;
  contentType?: string | null;
  version: number;
  size?: number | null;
  status: 'active' | 'removed';
};

async function callInternal<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const baseUrl = getDoqynAuthBaseUrl();
  const apiKey = getDoqynAuthInternalApiKey();

  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ServiceError(
      typeof data.message === 'string' ? data.message : 'Falha na comunicação com auth-service.',
      typeof data.code === 'string' ? data.code : 'AUTH_INTERNAL_FAILED',
      response.status,
    );
  }

  return data as T;
}

export async function fetchUserAvatarMetadata(userId: string): Promise<InternalAvatarMetadata> {
  const result = await callInternal<{ ok: true; metadata: InternalAvatarMetadata }>(
    `/internal/users/${encodeURIComponent(userId)}/avatar-metadata`,
  );
  return result.metadata;
}

export async function updateUserAvatarMetadata(
  userId: string,
  input: InternalAvatarUpdateInput,
): Promise<void> {
  await callInternal(`/internal/users/${encodeURIComponent(userId)}/avatar-metadata`, {
    method: 'PATCH',
    body: input,
  });
}

export async function fetchAuthTenantMembersForSync(
  tenantId: string,
): Promise<AuthTenantMemberSyncSnapshot[]> {
  const result = await callInternal<{ ok: true; members: AuthTenantMemberSyncSnapshot[] }>(
    `/internal/tenants/${encodeURIComponent(tenantId)}/members`,
  );
  return result.members ?? [];
}

/**
 * O diretório DOQYN: existe alguém com este e-mail?
 *
 * O auth-service devolve **resposta uniforme** — inexistente, desativado e (quando existir a
 * preferência de visibilidade) quem não quer ser achado têm a mesma forma. Repassar essa
 * uniformidade é responsabilidade de quem chama: transformar o `found: false` em erro, ou em
 * mensagem diferente conforme o caso, desfaz do lado de cá o que foi construído do lado de lá.
 */
export type DirectoryUserSnapshot = {
  id: string;
  displayName: string;
};

export async function lookupDirectoryUserByEmail(
  email: string,
): Promise<DirectoryUserSnapshot | null> {
  const result = await callInternal<{
    ok: true;
    found: boolean;
    user: DirectoryUserSnapshot | null;
  }>(`/internal/users/lookup?email=${encodeURIComponent(email)}`);

  return result.found ? (result.user ?? null) : null;
}

/**
 * A busca navegável do diretório, por prefixo de handle.
 *
 * É o único caminho digitável que o schema do auth-service permite: o nome está cifrado e o
 * e-mail só tem hash determinístico, e nenhum dos dois responde prefixo. O handle é a peça que
 * torna o diretório navegável sem tirar nome nenhum da criptografia.
 */
export type DirectorySearchHit = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarVersion: number;
  avatarStatus: 'active' | 'removed' | null;
};

export async function searchDirectoryUsersByUsername(
  prefix: string,
  limit = 8,
): Promise<DirectorySearchHit[]> {
  const query = `?q=${encodeURIComponent(prefix)}&limit=${encodeURIComponent(String(limit))}`;
  const result = await callInternal<{ ok: true; users?: DirectorySearchHit[] }>(
    `/internal/users/search${query}`,
  );
  return result.users ?? [];
}

/**
 * Apelido e nome de contas que já se conhece pelo id.
 *
 * Não é descoberta: quem chama já tem os ids. Serve para rotular quem está na tela — a lista de
 * contatos, o seletor de destinatário — sem guardar uma cópia do handle que envelheceria a cada
 * troca de apelido. O campo `username` do cadastro por tenant **não serve**: ele guarda o e-mail,
 * de um esquema anterior ao handle.
 */
export async function fetchUsernamesByIds(
  userIds: string[],
): Promise<Map<string, { username: string; displayName: string }>> {
  if (!userIds.length) return new Map();

  const result = await callInternal<{
    ok: true;
    users?: Array<{ id: string; username: string; displayName: string }>;
    // `callInternal` já serializa: passar string aqui mandaria JSON dentro de JSON.
  }>('/internal/users/usernames', { method: 'POST', body: { userIds } });

  return new Map(
    (result.users ?? []).map((user) => [
      user.id,
      { username: user.username, displayName: user.displayName },
    ]),
  );
}

/**
 * O idioma de cada conta, para o servidor falar com ela fora da tela — no e-mail.
 *
 * Perguntado no envio, e não copiado para o cadastro do tenant: quem troca o idioma no perfil
 * espera que o próximo aviso já chegue no idioma novo, e uma cópia só acompanharia na próxima
 * sincronização. Conta que o auth não devolve fica fora do mapa; quem chama cai no padrão.
 */
export async function fetchUserLocalesByIds(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();

  const result = await callInternal<{
    ok: true;
    users?: Array<{ id: string; locale: string }>;
  }>('/internal/users/locales', { method: 'POST', body: { userIds } });

  return new Map((result.users ?? []).map((user) => [user.id, user.locale]));
}

/**
 * O e-mail de um usuário, para o sistema entregar — não para a tela mostrar.
 *
 * A busca por apelido não devolve e-mail de propósito: entregá-lo a quem digitou duas letras faria
 * do diretório uma lista de endereços. Mas quem foi escolhido precisa receber aviso, e o convite
 * de assinatura precisa de um destinatário real. Esta chamada é servidor-para-servidor, com a
 * chave interna, e o resultado nunca volta ao cliente.
 */
export async function fetchDirectoryUserEmail(userId: string): Promise<string | null> {
  try {
    const result = await callInternal<{ ok: true; user?: { email?: string } }>(
      `/internal/users/${encodeURIComponent(userId)}`,
    );
    return result.user?.email?.trim().toLowerCase() ?? null;
  } catch {
    // Sem e-mail, o fluxo segue: o que depende dele é entrega, não autorização.
    return null;
  }
}
