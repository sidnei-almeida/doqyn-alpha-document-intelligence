import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { isValidEmail, normalizeEmail } from '../../utils/contactNormalize.js';

export type ResolvedInternalSigner = {
  userId: string;
  name: string;
  email: string;
  emailNormalized: string;
};

const BLOCKED_MEMBER_STATUSES = new Set(['pending', 'blocked', 'rejected']);

export async function resolveInternalSignerForTenant(
  ctx: DocumentRequestContext,
  requester: AuthUser,
  signerUserId: string,
): Promise<ResolvedInternalSigner> {
  if (!signerUserId?.trim()) {
    throw new ServiceError('Usuário signatário é obrigatório.', 'SIGNER_USER_REQUIRED', 400);
  }
  if (signerUserId === requester.id) {
    throw new ServiceError('Não é possível solicitar assinatura para você mesmo.', 'SIGNER_SELF_FORBIDDEN', 400);
  }

  const members = await listOperationalTenantMembers(ctx.tenantId);
  const member = members
    .map(serializeTenantMember)
    .find((item) => item.userId === signerUserId);
  if (!member) {
    throw new ServiceError('Usuário não pertence a esta empresa.', 'SIGNER_TENANT_MISMATCH', 403);
  }
  if (BLOCKED_MEMBER_STATUSES.has(member.status)) {
    throw new ServiceError('Usuário indisponível para assinatura.', 'SIGNER_NOT_ACTIVE', 403);
  }
  if (!member.email?.trim() || !isValidEmail(member.email)) {
    throw new ServiceError('Usuário sem e-mail válido.', 'SIGNER_EMAIL_INVALID', 400);
  }

  const name = member.name?.trim() || member.email;

  return {
    userId: signerUserId,
    name,
    email: member.email.trim(),
    emailNormalized: normalizeEmail(member.email),
  };
}
