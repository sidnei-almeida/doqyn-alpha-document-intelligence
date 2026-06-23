import { SignJWT, jwtVerify } from 'jose';
import { parse, serialize } from 'cookie';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthRole, AuthUser, SessionPayload } from './types';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or too short. Use at least 32 characters.');
  }

  return new TextEncoder().encode(secret);
}

export function getAuthCookieName() {
  return process.env.AUTH_COOKIE_NAME || 'doqyn_session';
}

export function getSessionMaxAgeSeconds() {
  const raw = process.env.AUTH_SESSION_MAX_AGE_SECONDS || '43200';
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    return 43200;
  }

  return value;
}

export function shouldUseSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

export async function createSessionToken(user: AuthUser, maxAgeSeconds?: number) {
  const maxAge = maxAgeSeconds ?? getSessionMaxAgeSeconds();

  return new SignJWT({
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    companyName: user.companyName,
    role: user.role,
    area: user.area,
    groups: user.groups,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, getJwtSecret());

  if (!payload.sub || !payload.email || !payload.name || !payload.companyId) {
    throw new Error('Invalid session payload');
  }

  const session = payload as SessionPayload;

  return {
    id: payload.sub,
    email: String(session.email),
    name: String(session.name),

    companyId: String(session.companyId),
    companyName: String(session.companyName),

    role: (session.role || 'admin') as AuthRole,
    area: String(session.area),
    groups: Array.isArray(session.groups) ? session.groups.map(String) : [],
  };
}

export function setSessionCookie(res: VercelResponse, token: string, maxAgeSeconds?: number) {
  const maxAge = maxAgeSeconds ?? getSessionMaxAgeSeconds();

  const cookie = serialize(getAuthCookieName(), token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res: VercelResponse) {
  const cookie = serialize(getAuthCookieName(), '', {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  res.setHeader('Set-Cookie', cookie);
}

export function getTokenFromRequest(req: VercelRequest) {
  const rawCookie = req.headers.cookie;

  if (!rawCookie) {
    return null;
  }

  const cookies = parse(rawCookie);

  return cookies[getAuthCookieName()] || null;
}

export async function getSessionFromRequest(req: VercelRequest) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
