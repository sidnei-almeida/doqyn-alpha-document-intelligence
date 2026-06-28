import 'dotenv/config';

export function requireMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI não configurada. Defina no .env antes de continuar.');
  }
  return uri;
}

export function maskUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = parsed.username.slice(0, 3) + '***';
    return parsed.toString();
  } catch {
    return uri.replace(/:([^:@/]+)@/, ':***@');
  }
}

export function isProductionLikeUri(uri) {
  const lower = uri.toLowerCase();
  return (
    lower.includes('prod') ||
    lower.includes('production') ||
    process.env.APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

const SENSITIVE_KEYS = /password|secret|token|taxid|cpf|cnpj|email|phone|whatsapp|uri/i;

export function maskDocument(value, depth = 0) {
  if (depth > 6) return '[truncado]';
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 3).map((item) => maskDocument(item, depth + 1));
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 120) return `${value.slice(0, 40)}…[${value.length} chars]`;
    return value;
  }

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(key)) {
      if (typeof val === 'string' && val.includes('@')) {
        const [user, domain] = val.split('@');
        out[key] = `${user.slice(0, 2)}***@${domain}`;
      } else if (typeof val === 'string' && val.length > 4) {
        out[key] = `***${val.slice(-2)}`;
      } else {
        out[key] = '***';
      }
    } else {
      out[key] = maskDocument(val, depth + 1);
    }
  }
  return out;
}

export async function pickLatestTimestamp(collection) {
  for (const field of ['updatedAt', 'createdAt', 'completedAt']) {
    const doc = await collection.find({ [field]: { $exists: true } }).sort({ [field]: -1 }).limit(1).next();
    if (doc?.[field]) {
      const value = doc[field];
      return value instanceof Date ? value.toISOString() : String(value);
    }
  }
  return null;
}
