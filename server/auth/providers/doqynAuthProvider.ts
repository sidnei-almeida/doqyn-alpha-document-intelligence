import { parse } from 'cookie';
import type { VercelRequest } from '@vercel/node';
import type { AuthRole, AuthUser, PlatformRole } from '../types.js';
import {
  getDoqynAuthBaseUrl,
  getDoqynAuthCookieName,
  getDoqynAuthInternalApiKey,
} from '../authConfig.js';
import { ServiceError } from '../../utils/serviceErrors.js';

export type DoqynPublicUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  whatsapp?: string | null;
  status: 'active' | 'disabled' | 'pending_verification' | 'anonymized';
  emailVerified?: boolean;
};

export type DoqynPublicMembership = {
  membershipId: string;
  tenantId: string;
  tenantType: 'individual' | 'business';
  tenantDisplayName: string | null;
  status: 'pending' | 'active' | 'blocked' | 'rejected' | 'removed';
  roles: PlatformRole[];
  accessGroupIds: string[];
};

export type DoqynVerifiedSession = {
  user: DoqynPublicUser;
  activeMembership: DoqynPublicMembership | null;
  memberships: Array<
    Pick<
      DoqynPublicMembership,
      'membershipId' | 'tenantId' | 'tenantType' | 'tenantDisplayName' | 'status'
    >
  >;
};

export type DoqynVerifyFailureCode =
  | 'INVALID_SESSION'
  | 'USER_NOT_ACTIVE'
  | 'TENANT_NOT_ACTIVE'
  | 'TENANT_INACTIVE'
  | 'MEMBERSHIP_NOT_ACTIVE'
  | 'MEMBERSHIP_PENDING'
  | 'MEMBERSHIP_BLOCKED'
  | 'MEMBERSHIP_REJECTED'
  | 'MEMBERSHIP_REMOVED'
  | 'NO_SESSION'
  | 'SESSION_EXPIRED'
  | 'AUTH_REQUIRED';

const VERIFY_CODE_TO_HTTP: Record<string, number> = {
  INVALID_SESSION: 401,
  NO_SESSION: 401,
  SESSION_EXPIRED: 401,
  AUTH_REQUIRED: 401,
  USER_NOT_ACTIVE: 403,
  TENANT_NOT_ACTIVE: 403,
  TENANT_INACTIVE: 403,
  MEMBERSHIP_NOT_ACTIVE: 403,
  MEMBERSHIP_PENDING: 403,
  MEMBERSHIP_BLOCKED: 403,
  MEMBERSHIP_REJECTED: 403,
  MEMBERSHIP_REMOVED: 403,
};

function mapRolesToAuthRole(roles: PlatformRole[]): AuthRole {
  if (roles.includes('doqyn_admin')) return 'admin';
  if (roles.includes('company_admin') || roles.includes('individual_admin')) return 'manager';
  return 'user';
}

export function getDoqynSessionTokenFromRequest(req: VercelRequest): string | null {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return null;

  const cookies = parse(rawCookie);
  return cookies[getDoqynAuthCookieName()] ?? null;
}

export function mapDoqynSessionToAuthUser(session: DoqynVerifiedSession): AuthUser {
  const { user, activeMembership } = session;
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const roles = activeMembership?.roles ?? ['user'];
  const accessGroupIds = activeMembership?.accessGroupIds ?? [];

  return {
    id: user.id,
    email: user.email,
    name: displayName,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    companyId: activeMembership?.tenantId ?? '',
    tenantId: activeMembership?.tenantId ?? '',
    companyName: activeMembership?.tenantDisplayName ?? '',
    role: mapRolesToAuthRole(roles),
    area: '',
    groups: accessGroupIds,
    memberId: activeMembership?.membershipId,
    membershipId: activeMembership?.membershipId,
    platformRoles: roles,
    membershipStatus: activeMembership?.status,
    tenantType: activeMembership?.tenantType,
    tenantStatus: activeMembership ? 'active' : undefined,
    authProvider: 'doqyn_auth',
  };
}

export async function verifyDoqynAuthSession(
  req: VercelRequest,
): Promise<DoqynVerifiedSession | null> {
  const sessionToken = getDoqynSessionTokenFromRequest(req);
  if (!sessionToken) return null;

  const baseUrl = getDoqynAuthBaseUrl();
  const apiKey = getDoqynAuthInternalApiKey();

  const response = await fetch(`${baseUrl}/internal/sessions/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionToken }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    code?: DoqynVerifyFailureCode;
    message?: string;
    user?: DoqynPublicUser;
    activeMembership?: DoqynPublicMembership | null;
    memberships?: DoqynVerifiedSession['memberships'];
  };

  if (!data.ok) {
    const code = data.code ?? 'INVALID_SESSION';
    throw new ServiceError(
      data.message ?? 'Sessão inválida.',
      code,
      VERIFY_CODE_TO_HTTP[code] ?? 401,
    );
  }

  if (!data.user) {
    throw new ServiceError('Resposta inválida do auth-service.', 'INVALID_SESSION', 502);
  }

  return {
    user: data.user,
    activeMembership: data.activeMembership ?? null,
    memberships: data.memberships ?? [],
  };
}
