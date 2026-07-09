import { createHash, randomBytes, randomInt } from 'node:crypto';
import { resolveSignatureConfig } from '../../config/signatureConfig.js';

export function generateSignaturePortalToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSignaturePortalToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function generateVerificationCode(): string {
  const year = new Date().getFullYear();
  const prefix = resolveSignatureConfig().verificationCodePrefix;
  const suffix = randomInt(0, 36 ** 6)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0');
  return `${prefix}-${year}-${suffix}`;
}
