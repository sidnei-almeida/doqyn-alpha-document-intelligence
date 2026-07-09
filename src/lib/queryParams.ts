/** Remove entradas vazias antes de URLSearchParams — evita `search=undefined` na query. */
export function serializeQueryParams(
  params?: Record<string, string | undefined | null>,
): string {
  if (!params) return '';

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
  );

  if (entries.length === 0) return '';

  return `?${new URLSearchParams(
    Object.fromEntries(entries.map(([key, value]) => [key, String(value)])),
  )}`;
}
