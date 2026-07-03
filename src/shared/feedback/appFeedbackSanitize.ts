export function sanitizeToastText(value: string): string {
  return value
    .replace(/passwordHash/gi, '[redigido]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, '[redigido]')
    .replace(/gsk_[a-zA-Z0-9]+/g, '[redigido]')
    .trim();
}
