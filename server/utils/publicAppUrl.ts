import type { VercelRequest } from '@vercel/node';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Origem pública absoluta do app (usada em og:url, og:image e links de convite). */
export function resolvePublicAppOrigin(req?: Pick<VercelRequest, 'headers'>): string {
  const fromEnv = process.env.DOQYN_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, '')}`;

  const forwardedHost = firstHeaderValue(req?.headers?.['x-forwarded-host']);
  const host = forwardedHost ?? firstHeaderValue(req?.headers?.host);
  if (host) {
    const proto =
      firstHeaderValue(req?.headers?.['x-forwarded-proto']) ??
      (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return 'http://localhost:5173';
}

export function toAbsolutePublicUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin.replace(/\/$/, '')}${normalized}`;
}
