/**
 * Resolve o Auth userId a partir de documentos de membro.
 * Campo canônico no Mongo: `authUserId`.
 */
export function resolveMemberAuthUserId(member: {
  authUserId?: string | null;
  userId?: string | null;
}): string | undefined {
  const value = member.authUserId ?? member.userId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Filtro por Auth userId (campo canônico). */
export function memberAuthUserIdEquals(userId: string): Record<string, unknown> {
  return { authUserId: userId };
}

export function memberAuthUserIdIn(userIds: string[]): Record<string, unknown> {
  return { authUserId: { $in: userIds } };
}
