const AUTH_ERROR_MESSAGES: Record<string, string> = {
  NO_ACTIVE_MEMBERSHIP: 'Sua conta ainda não possui acesso ativo a nenhuma empresa.',
  MEMBERSHIP_PENDING: 'Sua solicitação de acesso ainda está aguardando aprovação.',
  MEMBERSHIP_BLOCKED: 'Seu acesso a esta empresa foi bloqueado.',
  MEMBERSHIP_REJECTED: 'Sua solicitação de acesso a esta empresa foi rejeitada.',
  TENANT_INACTIVE: 'Esta empresa não está ativa no DOQYN.',
  NO_ACTIVE_TENANT: 'Selecione uma empresa para continuar.',
};

type MembershipLike = {
  status: 'pending' | 'active' | 'blocked' | 'rejected' | 'removed';
  tenant?: { status?: string };
};

export function resolveMembershipAccessError(memberships: MembershipLike[]): {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
} {
  const visible = memberships.filter((membership) => membership.status !== 'removed');

  if (visible.length === 0) {
    return {
      code: 'NO_ACTIVE_MEMBERSHIP',
      message: AUTH_ERROR_MESSAGES.NO_ACTIVE_MEMBERSHIP,
      statusCode: 403,
    };
  }

  const blocked = visible.find((membership) => membership.status === 'blocked');
  if (blocked) {
    return {
      code: 'MEMBERSHIP_BLOCKED',
      message: AUTH_ERROR_MESSAGES.MEMBERSHIP_BLOCKED,
      statusCode: 403,
      details: { status: 'blocked' },
    };
  }

  const rejected = visible.find((membership) => membership.status === 'rejected');
  if (rejected) {
    return {
      code: 'MEMBERSHIP_REJECTED',
      message: AUTH_ERROR_MESSAGES.MEMBERSHIP_REJECTED,
      statusCode: 403,
      details: { status: 'rejected' },
    };
  }

  const pendingOnly = visible.every((membership) => membership.status === 'pending');
  if (pendingOnly) {
    return {
      code: 'MEMBERSHIP_PENDING',
      message: AUTH_ERROR_MESSAGES.MEMBERSHIP_PENDING,
      statusCode: 403,
      details: { status: 'pending' },
    };
  }

  const activeMemberships = visible.filter((membership) => membership.status === 'active');
  if (activeMemberships.length > 1) {
    return {
      code: 'NO_ACTIVE_TENANT',
      message: AUTH_ERROR_MESSAGES.NO_ACTIVE_TENANT,
      statusCode: 409,
      details: { activeMembershipCount: activeMemberships.length },
    };
  }

  return {
    code: 'NO_ACTIVE_MEMBERSHIP',
    message: AUTH_ERROR_MESSAGES.NO_ACTIVE_MEMBERSHIP,
    statusCode: 403,
  };
}
