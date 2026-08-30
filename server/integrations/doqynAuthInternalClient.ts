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

/**
 * Detalhe de uma solicitação de acesso, como o auth-service a serializa.
 *
 * Só os campos que a fila de pendências mostra. O DTO de lá tem mais — decisão, ids internos —
 * e não replicar o que não se usa evita ter de acompanhar mudanças que não interessam.
 */
export type AuthAccessRequestSnapshot = {
  id: string;
  status: string;
  membershipId: string | null;
  tenantId: string;
  tenantName: string | null;
  requestedAt: string;
  requester: {
    name: string;
    email: string;
    whatsapp: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  requestedAccess: Record<string, unknown> | null;
  consent: Record<string, unknown> | null;
  terms: Record<string, unknown> | null;
  notificationPreferences: Record<string, unknown> | null;
};

export async function fetchTenantAccessRequests(
  tenantId: string,
  status = 'pending',
): Promise<AuthAccessRequestSnapshot[]> {
  const query = `?status=${encodeURIComponent(status)}`;
  const data = await callInternal<{ requests?: AuthAccessRequestSnapshot[] }>(
    `/internal/tenants/${encodeURIComponent(tenantId)}/access-requests${query}`,
  );
  return data.requests ?? [];
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
