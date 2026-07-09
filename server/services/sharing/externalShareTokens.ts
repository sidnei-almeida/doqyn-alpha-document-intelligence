import { createHash, randomBytes } from 'node:crypto';

export function generateExternalShareInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashExternalShareToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}
