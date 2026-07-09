/** Calcula próxima versão major no frontend (espelha server/utils/versionLabelUtils). */
export function normalizeVersionLabel(label?: string | null): string {
  if (!label?.trim()) return 'v1.0';
  const match = /^v(\d+)(?:\.(\d+))?$/i.exec(label.trim());
  if (!match) return 'v1.0';
  const major = Number.parseInt(match[1] ?? '1', 10) || 1;
  return `v${major}.0`;
}

export function nextMajorVersionLabel(currentLabel?: string | null): string {
  const normalized = normalizeVersionLabel(currentLabel);
  const match = /^v(\d+)/i.exec(normalized);
  const major = Number.parseInt(match?.[1] ?? '1', 10) || 1;
  return `v${major + 1}.0`;
}
