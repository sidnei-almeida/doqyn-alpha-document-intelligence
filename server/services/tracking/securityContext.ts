import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { isPrivateOrLoopbackIp, lookupApproximateGeoFromIp } from './geoIpResolver.js';
import { hashTrackingValue } from './trackingSecurity.js';

export type TrackingSecurityContext = {
  ipAddressMasked?: string;
  ipHash?: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  userAgent?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  sessionIdHash?: string;
  requestId?: string;
  authMethod?: string;
  isExternalGuest?: boolean;
  isLocalNetwork?: boolean;
  permissionResult?: 'allowed' | 'denied';
  permissionReason?: string;
  requiredPermission?: string;
};

export type BuildSecurityContextOptions = Partial<TrackingSecurityContext> & {
  /** IP completo — nunca persistido em securityContext; usado só para hash/máscara/audit restrito. */
  _clientIp?: string;
};

function headerValue(headers: VercelRequest['headers'], name: string): string | undefined {
  const raw = headers[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : undefined;
}

/** Resolve IP do cliente com prioridade para proxies conhecidos. */
export function resolveClientIp(
  req: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] },
): string | undefined {
  const cfConnectingIp = headerValue(req.headers, 'cf-connecting-ip');
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  const forwarded = headerValue(req.headers, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = headerValue(req.headers, 'x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  return req.socket?.remoteAddress ?? undefined;
}

/** Mascara IPv4/IPv6 para exibição comum — ex.: 189.45.xxx.xxx */
export function maskIpAddress(ip: string): string {
  const normalized = ip.replace(/^::ffff:/i, '').trim();
  if (!normalized) return 'xxx.xxx.xxx.xxx';
  if (isPrivateOrLoopbackIp(normalized)) return 'rede local';

  if (normalized.includes('.') && !normalized.includes(':')) {
    const parts = normalized.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
  }

  if (normalized.includes(':')) {
    const segments = normalized.split(':').filter(Boolean);
    if (segments.length > 0) {
      return `${segments[0]}:…`;
    }
  }

  return 'xxx.xxx.xxx.xxx';
}

function mapWindowsVersion(ntVersion: string): string | undefined {
  switch (ntVersion) {
    case '10.0':
      return '10/11';
    case '6.3':
      return '8.1';
    case '6.2':
      return '8';
    case '6.1':
      return '7';
    default:
      return ntVersion;
  }
}

export function parseUserAgentDetails(userAgent?: string): Pick<
  TrackingSecurityContext,
  'userAgent' | 'browser' | 'browserVersion' | 'os' | 'osVersion' | 'deviceType'
> {
  if (!userAgent?.trim()) {
    return { deviceType: 'unknown' };
  }

  const ua = userAgent.trim();

  let browser = 'Navegador';
  let browserVersion: string | undefined;

  const edgeMatch = ua.match(/Edg\/([\d.]+)/i);
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/i);
  const firefoxMatch = ua.match(/Firefox\/([\d.]+)/i);
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/i);

  if (edgeMatch) {
    browser = 'Edge';
    browserVersion = edgeMatch[1];
  } else if (chromeMatch && !/Edg/i.test(ua)) {
    browser = 'Chrome';
    browserVersion = chromeMatch[1];
  } else if (firefoxMatch) {
    browser = 'Firefox';
    browserVersion = firefoxMatch[1];
  } else if (safariMatch) {
    browser = 'Safari';
    browserVersion = safariMatch[1];
  }

  let os = 'Desconhecido';
  let osVersion: string | undefined;

  const windowsMatch = ua.match(/Windows NT ([\d.]+)/i);
  const macMatch = ua.match(/Mac OS X ([\d_]+)/i);
  const androidMatch = ua.match(/Android ([\d.]+)/i);
  const iosMatch = ua.match(/OS ([\d_]+) like Mac OS X/i);

  if (windowsMatch) {
    os = 'Windows';
    osVersion = mapWindowsVersion(windowsMatch[1]);
  } else if (macMatch) {
    os = 'macOS';
    osVersion = macMatch[1].replace(/_/g, '.');
  } else if (androidMatch) {
    os = 'Android';
    osVersion = androidMatch[1];
  } else if (iosMatch) {
    os = 'iOS';
    osVersion = iosMatch[1].replace(/_/g, '.');
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let deviceType: TrackingSecurityContext['deviceType'] = 'desktop';
  if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet';
  else if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'mobile';

  const browserLabel = browserVersion ? `${browser} ${browserVersion.split('.')[0]}` : browser;
  const osLabel = osVersion ? `${os} ${osVersion}` : os;
  const summary = `${browserLabel} em ${osLabel}`;

  return {
    userAgent: summary,
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
  };
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

export function resolveApproximateGeo(
  req: Pick<VercelRequest, 'headers'>,
  clientIp?: string,
): Pick<TrackingSecurityContext, 'country' | 'region' | 'city' | 'timezone'> {
  const fromHeaders = {
    country: headerValue(req.headers, 'cf-ipcountry') ?? undefined,
    region: headerValue(req.headers, 'cf-region') ?? undefined,
    city: headerValue(req.headers, 'cf-ipcity') ?? undefined,
  };

  if (fromHeaders.country || fromHeaders.city) {
    return fromHeaders;
  }

  if (!clientIp || isPrivateOrLoopbackIp(clientIp)) {
    return {};
  }

  return lookupApproximateGeoFromIp(clientIp);
}

function resolveTimezone(req: Pick<VercelRequest, 'headers'>): string | undefined {
  return (
    headerValue(req.headers, 'x-timezone') ??
    headerValue(req.headers, 'cf-timezone') ??
    undefined
  );
}

function resolveIpHashSalt(): string {
  return process.env.TRACKING_IP_HASH_SALT?.trim() || 'doqyn-ip-v1';
}

/** Criptografa IP completo para auditoria de segurança restrita (não exposto na UI comum). */
export function encryptIpForSecurityAudit(ip: string): string | undefined {
  const secret = process.env.TRACKING_IP_ENCRYPTION_KEY?.trim();
  if (!secret || !ip.trim()) return undefined;

  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(ip.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function buildSecurityAuditRestricted(clientIp?: string): Record<string, unknown> | undefined {
  if (!clientIp?.trim()) return undefined;
  const encrypted = encryptIpForSecurityAudit(clientIp);
  if (!encrypted) return undefined;
  return {
    ipAddressEncrypted: encrypted,
    retentionPolicy: 'security_audit_restricted',
  };
}

export function buildSecurityContext(
  req?: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] },
  options: BuildSecurityContextOptions = {},
): TrackingSecurityContext {
  const {
    _clientIp,
    permissionResult,
    permissionReason,
    requiredPermission,
    requestId,
    authMethod,
    isExternalGuest,
    country,
    region,
    city,
    timezone,
    ...rest
  } = options;

  if (!req) {
    return {
      requestId,
      authMethod: authMethod ?? 'session',
      isExternalGuest: isExternalGuest === true,
      permissionResult,
      permissionReason,
      requiredPermission,
      country,
      region,
      city,
      timezone,
      ...rest,
    };
  }

  const clientIp = _clientIp ?? resolveClientIp(req);
  const isLocalNetwork = clientIp ? isPrivateOrLoopbackIp(clientIp) : false;
  const rawUserAgent = headerValue(req.headers, 'user-agent');
  const parsedUa = parseUserAgentDetails(rawUserAgent);
  const geo = resolveApproximateGeo(req, clientIp);

  return {
    ipAddressMasked: clientIp ? maskIpAddress(clientIp) : undefined,
    ipHash: clientIp ? hashTrackingValue(clientIp, resolveIpHashSalt()) : undefined,
    country: country ?? geo.country,
    region: region ?? geo.region,
    city: city ?? geo.city,
    timezone: timezone ?? resolveTimezone(req) ?? geo.timezone,
    isLocalNetwork,
    sessionIdHash: resolveSessionIdHash(req),
    requestId,
    authMethod: authMethod ?? (isExternalGuest ? 'external_share_token' : 'session'),
    isExternalGuest: isExternalGuest === true,
    permissionResult,
    permissionReason,
    requiredPermission,
    ...parsedUa,
    ...rest,
  };
}

/** Compatibilidade com metadata.security legado. */
export function securityContextToLegacySnapshot(
  context: TrackingSecurityContext,
): Record<string, unknown> {
  return {
    ipHash: context.ipHash,
    userAgentHash: context.userAgent ? hashTrackingValue(context.userAgent) : undefined,
    userAgentSummary: context.userAgent,
    sessionIdHash: context.sessionIdHash,
    authMethod: context.authMethod,
    permissionResult: context.permissionResult,
    permissionReason: context.permissionReason,
    requiredPermission: context.requiredPermission,
  };
}
