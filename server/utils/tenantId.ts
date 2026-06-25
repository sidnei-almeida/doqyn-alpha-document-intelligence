const MAX_TENANT_ID_LENGTH = 48;

export function isSafeTenantIdentifier(value: string): boolean {
  if (!value || value.length > MAX_TENANT_ID_LENGTH) return false;
  if (!/^[a-z][a-z0-9_]*$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length === value.length && (digits.length === 11 || digits.length === 14)) {
    return false;
  }
  return true;
}
