import { createHash } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

export type TrackingSecuritySnapshot = {
  ipHash?: string;
  userAgentHash?: string;
  userAgentSummary?: string;
  sessionIdHash?: string;
  authMethod?: string;
  permissionResult?: 'allowed' | 'denied';
  permissionReason?: string;
  requiredPermission?: string;
};

export function hashTrackingValue(value: string, salt = 'doqyn-tracking-v1'): string {
  return createHash('sha256').update(`${salt}:${value.trim()}`).digest('hex').slice(0, 32);
}

function headerValue(
  headers: VercelRequest['headers'],
  name: string,
): string | undefined {
  const raw = headers[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : undefined;
}

export function resolveClientIp(req: Pick<VercelRequest, 'headers' | 'socket'>): string | undefined {
  const forwarded = headerValue(req.headers, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headerValue(req.headers, 'x-real-ip');
  if (realIp) return realIp;
  return req.socket?.remoteAddress ?? undefined;
}

export function parseUserAgentSummary(userAgent?: string): string | undefined {
  if (!userAgent?.trim()) return undefined;
  const ua = userAgent.trim();
  if (ua.length > 120) return `${ua.slice(0, 117)}...`;

  let browser = 'Navegador';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  let os = 'Desktop';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
}

export function resolveSessionIdHash(req: Pick<VercelRequest, 'headers'>): string | undefined {
  const cookie = headerValue(req.headers, 'cookie');
  if (!cookie) return undefined;
  const sessionPair = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('doqyn_session=') || part.startsWith('connect.sid='));
  if (!sessionPair) return undefined;
  const value = sessionPair.split('=').slice(1).join('=');
  return value ? hashTrackingValue(value, 'doqyn-session-v1') : undefined;
}

export function buildSecuritySnapshot(
  req?: Pick<VercelRequest, 'headers' | 'socket'>,
  overrides: Partial<TrackingSecuritySnapshot> = {},
): TrackingSecuritySnapshot {
  if (!req) return { ...overrides };

  const ip = resolveClientIp(req);
  const userAgent = headerValue(req.headers, 'user-agent');

  return {
    ipHash: ip ? hashTrackingValue(ip) : undefined,
    userAgentHash: userAgent ? hashTrackingValue(userAgent) : undefined,
    userAgentSummary: parseUserAgentSummary(userAgent),
    sessionIdHash: resolveSessionIdHash(req),
    authMethod: 'session',
    ...overrides,
  };
}
