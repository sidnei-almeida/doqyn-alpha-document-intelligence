import { createHash } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import {
  buildSecurityContext,
  parseUserAgentDetails,
  resolveClientIp,
  type TrackingSecurityContext,
} from './securityContext.js';

export type TrackingSecuritySnapshot = TrackingSecurityContext;

export function hashTrackingValue(value: string, salt = 'doqyn-tracking-v1'): string {
  return createHash('sha256').update(`${salt}:${value.trim()}`).digest('hex').slice(0, 32);
}

export function parseUserAgentSummary(userAgent?: string): string | undefined {
  return parseUserAgentDetails(userAgent).userAgent;
}

export { resolveClientIp } from './securityContext.js';

export function resolveSessionIdHash(req: Pick<VercelRequest, 'headers'>): string | undefined {
  return buildSecurityContext(req).sessionIdHash;
}

export function buildSecuritySnapshot(
  req?: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] },
  overrides: Partial<TrackingSecuritySnapshot> = {},
): TrackingSecuritySnapshot {
  const clientIp = req ? resolveClientIp(req) : undefined;
  return buildSecurityContext(req, {
    ...overrides,
    _clientIp: clientIp,
  });
}
