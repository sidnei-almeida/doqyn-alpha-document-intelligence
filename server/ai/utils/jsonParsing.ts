export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  return trimmed.slice(start, end + 1);
}

export function safeParseJsonFromModel<T>(raw: string): T | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}
