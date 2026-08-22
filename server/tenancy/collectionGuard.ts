/** Detecta prefixo que parece CPF/CNPJ cru (apenas dígitos, 11 ou 14). */
export function isUnsafeCollectionPrefix(prefix: string): boolean {
  const trimmed = prefix.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === trimmed.length && (digits.length === 11 || digits.length === 14)) {
    return true;
  }
  return false;
}
