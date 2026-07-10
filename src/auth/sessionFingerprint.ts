import type { MeMembership, MeTenant } from './sessionTypes';
import type { AuthUser } from '@/features/auth/types';

export function buildSessionFingerprint(input: {
  userId?: string | null;
  tenantId?: string | null;
  membership?: MeMembership | null;
}): string | null {
  const userId = input.userId?.trim();
  const tenantId = input.tenantId?.trim();
  if (!userId || !tenantId) return null;

  const roles = [...(input.membership?.tenantRoles ?? [])].sort().join(',');
  const groups = [...(input.membership?.accessGroupIds ?? [])].sort().join(',');
  const status = input.membership?.status ?? '';

  return `${userId}|${tenantId}|${status}|${roles}|${groups}`;
}

export function buildSessionFingerprintFromAuth(input: {
  user?: AuthUser | null;
  tenant?: MeTenant | null;
  membership?: MeMembership | null;
}): string | null {
  return buildSessionFingerprint({
    userId: input.user?.id ?? null,
    tenantId: input.tenant?.tenantId ?? input.user?.companyId ?? null,
    membership: input.membership,
  });
}
