import { randomBytes } from 'node:crypto';
import {
  getKeycloakAdminClientId,
  getKeycloakAdminClientSecret,
  getKeycloakBaseUrl,
  getKeycloakRealm,
  isKeycloakAdminConfigured,
} from '../utils/keycloakEnv.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { logger } from '../utils/logger.js';

type KeycloakUser = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
};

let adminTokenCache: { token: string; expiresAt: number } | null = null;

function adminRealmBase(): string {
  return `${getKeycloakBaseUrl()}/admin/realms/${getKeycloakRealm()}`;
}

function tokenEndpoint(): string {
  return `${getKeycloakBaseUrl()}/realms/${getKeycloakRealm()}/protocol/openid-connect/token`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function getAdminToken(): Promise<string> {
  if (!isKeycloakAdminConfigured()) {
    throw new ServiceError(
      'Integração administrativa do Keycloak não configurada.',
      'KEYCLOAK_ADMIN_NOT_CONFIGURED',
      503,
    );
  }

  const now = Date.now();
  if (adminTokenCache && adminTokenCache.expiresAt > now + 30_000) {
    return adminTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: getKeycloakAdminClientId(),
    client_secret: getKeycloakAdminClientSecret(),
  });

  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await parseJson<{ access_token?: string; expires_in?: number; error?: string }>(
    response,
  );

  if (!response.ok || !data.access_token) {
    logger.error('Keycloak admin token request failed', {
      status: response.status,
      error: data.error,
    });
    throw new ServiceError(
      'Não foi possível autenticar no Keycloak (admin).',
      'KEYCLOAK_ADMIN_AUTH_FAILED',
      502,
    );
  }

  adminTokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 300) * 1000,
  };

  return data.access_token;
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAdminToken();
  return fetch(`${adminRealmBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export async function findUserByEmail(email: string): Promise<KeycloakUser | null> {
  const response = await adminFetch(`/users?email=${encodeURIComponent(email)}&exact=true`);
  if (!response.ok) {
    throw new ServiceError('Falha ao buscar usuário no Keycloak.', 'KEYCLOAK_LOOKUP_FAILED', 502);
  }
  const users = await parseJson<KeycloakUser[]>(response);
  return users[0] ?? null;
}

export async function findUserById(userId: string): Promise<KeycloakUser | null> {
  const response = await adminFetch(`/users/${encodeURIComponent(userId)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ServiceError('Falha ao buscar usuário no Keycloak.', 'KEYCLOAK_LOOKUP_FAILED', 502);
  }
  return parseJson<KeycloakUser>(response);
}

export function generateTemporaryPassword(): string {
  const raw = randomBytes(18).toString('base64url');
  return `Doqyn!${raw}`;
}

export async function createUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  enabled?: boolean;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const username = input.username?.trim() || email;

  const response = await adminFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      enabled: input.enabled ?? true,
      emailVerified: true,
    }),
  });

  if (response.status === 409) {
    const existing = await findUserByEmail(email);
    if (!existing?.id) {
      throw new ServiceError('Usuário já existe no Keycloak.', 'KEYCLOAK_USER_EXISTS', 409);
    }
    return existing.id;
  }

  if (!response.ok) {
    throw new ServiceError('Falha ao criar usuário no Keycloak.', 'KEYCLOAK_CREATE_FAILED', 502);
  }

  const location = response.headers.get('location');
  if (location) {
    const id = location.split('/').pop();
    if (id) return id;
  }

  const created = await findUserByEmail(email);
  if (!created?.id) {
    throw new ServiceError('Usuário criado no Keycloak, mas ID não retornado.', 'KEYCLOAK_CREATE_FAILED', 502);
  }
  return created.id;
}

export async function setTemporaryPassword(userId: string, password: string): Promise<void> {
  const response = await adminFetch(`/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({
      type: 'password',
      value: password,
      temporary: true,
    }),
  });

  if (!response.ok) {
    throw new ServiceError('Falha ao definir senha no Keycloak.', 'KEYCLOAK_PASSWORD_FAILED', 502);
  }
}

async function getRealmRoleMap(): Promise<Map<string, { id: string; name: string }>> {
  const response = await adminFetch('/roles');
  if (!response.ok) {
    throw new ServiceError('Falha ao listar roles do Keycloak.', 'KEYCLOAK_ROLES_FAILED', 502);
  }
  const roles = await parseJson<Array<{ id: string; name: string }>>(response);
  return new Map(roles.map((role) => [role.name, role]));
}

export async function assignRealmRoles(userId: string, roles: string[]): Promise<void> {
  if (!roles.length) return;

  const roleMap = await getRealmRoleMap();
  const payload = roles
    .map((name) => roleMap.get(name))
    .filter((role): role is { id: string; name: string } => Boolean(role));

  if (!payload.length) return;

  const response = await adminFetch(`/users/${encodeURIComponent(userId)}/role-mappings/realm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ServiceError('Falha ao atribuir roles no Keycloak.', 'KEYCLOAK_ROLE_ASSIGN_FAILED', 502);
  }
}

export async function removeRealmRoles(userId: string, roles: string[]): Promise<void> {
  if (!roles.length) return;

  const roleMap = await getRealmRoleMap();
  const payload = roles
    .map((name) => roleMap.get(name))
    .filter((role): role is { id: string; name: string } => Boolean(role));

  if (!payload.length) return;

  const response = await adminFetch(`/users/${encodeURIComponent(userId)}/role-mappings/realm`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ServiceError('Falha ao remover roles no Keycloak.', 'KEYCLOAK_ROLE_REMOVE_FAILED', 502);
  }
}

export async function disableUser(userId: string): Promise<void> {
  const response = await adminFetch(`/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled: false }),
  });
  if (!response.ok) {
    throw new ServiceError('Falha ao desativar usuário no Keycloak.', 'KEYCLOAK_DISABLE_FAILED', 502);
  }
}

export async function enableUser(userId: string): Promise<void> {
  const response = await adminFetch(`/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled: true }),
  });
  if (!response.ok) {
    throw new ServiceError('Falha ao ativar usuário no Keycloak.', 'KEYCLOAK_ENABLE_FAILED', 502);
  }
}

export async function updateUserProfile(
  userId: string,
  input: { firstName?: string; lastName?: string; email?: string },
): Promise<void> {
  const response = await adminFetch(`/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
    }),
  });

  if (!response.ok) {
    throw new ServiceError('Falha ao atualizar usuário no Keycloak.', 'KEYCLOAK_UPDATE_FAILED', 502);
  }
}

export async function syncRealmRoles(userId: string, desiredRoles: string[]): Promise<void> {
  const allowed = new Set(['doqyn_admin', 'company_admin', 'user']);
  const target = [...new Set(desiredRoles.filter((role) => allowed.has(role)))];

  const response = await adminFetch(`/users/${encodeURIComponent(userId)}/role-mappings/realm`);
  if (!response.ok) {
    throw new ServiceError('Falha ao ler roles atuais no Keycloak.', 'KEYCLOAK_ROLES_FAILED', 502);
  }

  const current = await parseJson<Array<{ name: string }>>(response);
  const currentNames = current.map((role) => role.name).filter((name) => allowed.has(name));

  const toRemove = currentNames.filter((name) => !target.includes(name));
  const toAdd = target.filter((name) => !currentNames.includes(name));

  if (toRemove.length) await removeRealmRoles(userId, toRemove);
  if (toAdd.length) await assignRealmRoles(userId, toAdd);
}
