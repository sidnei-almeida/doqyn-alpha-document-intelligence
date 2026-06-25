import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import {
  getKeycloakFrontendClientId,
  getKeycloakIssuer,
  getKeycloakRealm,
  getKeycloakBaseUrl,
  isKeycloakJwtConfigured,
} from '../utils/keycloakEnv.js';

export type KeycloakJwtClaims = {
  sub: string;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  realm_access?: { roles?: string[] };
  azp?: string;
};

export type VerifiedKeycloakAuth = {
  keycloakUserId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  roles: string[];
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const baseUrl = getKeycloakBaseUrl();
    const realm = getKeycloakRealm();
    jwks = createRemoteJWKSet(
      new URL(`${baseUrl}/realms/${realm}/protocol/openid-connect/certs`),
    );
  }
  return jwks;
}

function extractRoles(payload: JWTPayload): string[] {
  const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
  return Array.isArray(realmAccess?.roles) ? realmAccess.roles : [];
}

function validateAudience(payload: JWTPayload): void {
  const frontendClientId = getKeycloakFrontendClientId();
  const aud = payload.aud;
  const azp = typeof payload.azp === 'string' ? payload.azp : undefined;

  const audList = Array.isArray(aud) ? aud : aud ? [String(aud)] : [];
  const audienceOk =
    audList.includes(frontendClientId) ||
    audList.includes('account') ||
    azp === frontendClientId;

  if (!audienceOk && audList.length > 0 && azp && azp !== frontendClientId) {
    throw new Error('JWT audience inválida para o client do DOQYN.');
  }
}

export async function verifyKeycloakAccessToken(token: string): Promise<VerifiedKeycloakAuth> {
  if (!isKeycloakJwtConfigured()) {
    throw new Error('Keycloak não configurado no backend.');
  }

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: getKeycloakIssuer(),
  });

  validateAudience(payload);

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) {
    throw new Error('JWT sem subject.');
  }

  const roles = extractRoles(payload);
  const username =
    typeof payload.preferred_username === 'string' ? payload.preferred_username : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const givenName = typeof payload.given_name === 'string' ? payload.given_name : undefined;
  const familyName = typeof payload.family_name === 'string' ? payload.family_name : undefined;
  const name =
    typeof payload.name === 'string'
      ? payload.name
      : [givenName, familyName].filter(Boolean).join(' ') || username || email;

  return {
    keycloakUserId: sub,
    username,
    email,
    firstName: givenName,
    lastName: familyName,
    name,
    roles,
  };
}

export function readBearerToken(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
