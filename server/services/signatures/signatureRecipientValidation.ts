import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import { listOperationalTenantMembers } from '../tenantMemberRepository.js';
import { serializeTenantMember } from '../memberSerialize.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { isValidEmail, normalizeEmail } from '../../utils/contactNormalize.js';
import { isInterTenantSharingEnabled } from '../../config/interTenantConfig.js';
import { lookupDirectoryUserByEmail } from '../../integrations/doqynAuthInternalClient.js';

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
    throw new ServiceError(
      'Não é possível solicitar assinatura para você mesmo.',
      'SIGNER_SELF_FORBIDDEN',
      400,
    );
  }

  const members = await listOperationalTenantMembers(ctx.tenantId);
  const member = members.map(serializeTenantMember).find((item) => item.userId === signerUserId);
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

/**
 * Quem assina, quando o e-mail aponta para fora.
 *
 * A assinatura é o verbo menos disruptivo dos três que atravessam a fronteira: o fluxo já trabalha
 * com token e página própria, e o signatário de outra empresa **não** ganha acesso ao acervo — ele
 * abre um documento, assina, e pronto. Não há ingresso a governar, e por isso aqui não nasce
 * concessão pendente como no compartilhamento.
 *
 * Membro de casa primeiro, sempre: o caminho de dentro já existe e não gasta chamada de rede.
 */
export async function resolveSignerByEmail(
  ctx: DocumentRequestContext,
  requester: AuthUser,
  rawEmail: string,
): Promise<{ signer: ResolvedInternalSigner; external: boolean }> {
  const email = rawEmail?.trim().toLowerCase() ?? '';

  if (!email || !isValidEmail(email)) {
    throw new ServiceError('E-mail do signatário inválido.', 'SIGNER_EMAIL_INVALID', 400);
  }
  if (email === requester.email?.trim().toLowerCase()) {
    throw new ServiceError(
      'Não é possível solicitar assinatura para você mesmo.',
      'SIGNER_SELF_FORBIDDEN',
      400,
    );
  }

  const members = await listOperationalTenantMembers(ctx.tenantId);
  const member = members
    .map(serializeTenantMember)
    .find((item) => item.email?.trim().toLowerCase() === email && Boolean(item.userId));

  if (member) {
    if (BLOCKED_MEMBER_STATUSES.has(member.status)) {
      throw new ServiceError('Usuário indisponível para assinatura.', 'SIGNER_NOT_ACTIVE', 403);
    }
    return {
      signer: {
        userId: member.userId,
        name: member.name?.trim() || member.email,
        email: member.email.trim(),
        emailNormalized: normalizeEmail(member.email),
      },
      external: false,
    };
  }

  if (!isInterTenantSharingEnabled()) {
    throw new ServiceError(
      'Esse e-mail não é de ninguém da sua empresa.',
      'SIGNER_OUTSIDE_TENANT',
      400,
    );
  }

  const found = await lookupDirectoryUserByEmail(email);
  if (!found) {
    throw new ServiceError(
      'Esse e-mail não tem conta DOQYN. Use o convite externo para pedir a assinatura.',
      'SIGNER_NOT_DOQYN',
      400,
    );
  }
  if (found.id === requester.id) {
    throw new ServiceError(
      'Não é possível solicitar assinatura para você mesmo.',
      'SIGNER_SELF_FORBIDDEN',
      400,
    );
  }

  return {
    signer: {
      userId: found.id,
      name: found.displayName || email,
      email,
      emailNormalized: normalizeEmail(email),
    },
    external: true,
  };
}
