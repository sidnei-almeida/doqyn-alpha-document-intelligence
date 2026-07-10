import type { VercelResponse } from '@vercel/node';
import { usesDoqynAuth } from './authConfig.js';

type LegacyEndpointKind = 'membership_invite' | 'public_access_request';

const MESSAGES: Record<LegacyEndpointKind, string> = {
  membership_invite:
    'Este endpoint foi descontinuado; use o convite via auth-service.',
  public_access_request:
    'Este endpoint foi descontinuado; use /auth/access-requests no auth-service.',
};

/** Bloqueia endpoints legados de membership/onboarding quando o provider é doqyn_auth. */
export function rejectLegacyAuthEndpoint(
  res: VercelResponse,
  kind: LegacyEndpointKind,
): boolean {
  if (!usesDoqynAuth()) {
    return false;
  }

  res.status(410).json({
    message: MESSAGES[kind],
    code: 'LEGACY_ENDPOINT_DEPRECATED',
  });
  return true;
}
