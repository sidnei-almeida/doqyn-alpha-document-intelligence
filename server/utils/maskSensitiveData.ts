function stripControlCharacters(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code !== 127) {
      result += char;
    } else if (/\s/.test(char)) {
      result += ' ';
    }
  }
  return result;
}

export function sanitizeRejectionReason(reason?: string): string {
  if (!reason?.trim()) {
    throw new Error('REJECTION_REASON_REQUIRED');
  }

  const cleaned = stripControlCharacters(reason).replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    throw new Error('REJECTION_REASON_REQUIRED');
  }

  return cleaned.slice(0, 500);
}

export function maskEmail(email?: string | null): string | undefined {
  if (!email?.trim()) return undefined;
  const normalized = email.trim();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return '[redigido]';
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > 2 ? '***' : ''}@${domain}`;
}
