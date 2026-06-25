import { getDoqynAuthBaseUrl, getDoqynAuthInternalApiKey, usesDoqynAuth } from '../auth/authConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type AuthServiceAccessGroup = {
  groupId: string;
  name: string;
  slug: string;
  status: string;
};

export async function fetchTenantAccessGroupsFromAuth(
  tenantTextId: string,
): Promise<AuthServiceAccessGroup[]> {
  if (!usesDoqynAuth()) {
    throw new ServiceError(
      'Grupos de acesso são gerenciados pelo auth-service. Configure AUTH_PROVIDER=doqyn_auth.',
      'ACCESS_GROUPS_AUTH_REQUIRED',
      503,
    );
  }

  const baseUrl = getDoqynAuthBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}/internal/tenants/${encodeURIComponent(tenantTextId)}/access-groups`;

  const response = await globalThis.fetch(url, {
    headers: {
      Authorization: `Bearer ${getDoqynAuthInternalApiKey()}`,
    },
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    groups?: AuthServiceAccessGroup[];
    message?: string;
  };

  if (!response.ok) {
    throw new ServiceError(
      data.message ?? 'Não foi possível carregar grupos de acesso.',
      'ACCESS_GROUPS_FETCH_FAILED',
      response.status,
    );
  }

  return data.groups ?? [];
}
