export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mantém apenas dígitos — esperado DDI+DDD+número quando informado. */
export function normalizeWhatsapp(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskWhatsappForLog(value: string): string {
  const digits = normalizeWhatsapp(value);
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.includes('@') && normalized.includes('.');
}

export function isValidWhatsapp(value: string): boolean {
  const digits = normalizeWhatsapp(value);
  return digits.length >= 10 && digits.length <= 15;
}
