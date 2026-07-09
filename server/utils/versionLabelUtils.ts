const VERSION_LABEL_PATTERN = /^v(\d+)(?:\.(\d+))?$/i;

/** Normaliza rótulos legados (v1, v2) para formato major vN.0. */
export function normalizeVersionLabel(label?: string | null): string {
  if (!label?.trim()) return 'v1.0';
  const trimmed = label.trim();
  const match = VERSION_LABEL_PATTERN.exec(trimmed);
  if (!match) return 'v1.0';
  const major = Number.parseInt(match[1] ?? '1', 10) || 1;
  return formatMajorVersionLabel(major);
}

export function parseMajorVersionNumber(label?: string | null): number {
  const normalized = normalizeVersionLabel(label);
  const match = VERSION_LABEL_PATTERN.exec(normalized);
  return Number.parseInt(match?.[1] ?? '1', 10) || 1;
}

export function formatMajorVersionLabel(major: number): string {
  const safe = Number.isFinite(major) && major >= 1 ? Math.floor(major) : 1;
  return `v${safe}.0`;
}

/** Próxima versão major: v1.0 -> v2.0, v2.0 -> v3.0. */
export function nextMajorVersionLabel(currentLabel?: string | null): string {
  const currentMajor = parseMajorVersionNumber(currentLabel);
  return formatMajorVersionLabel(currentMajor + 1);
}

export function resolveVersionCountFromLabels(
  storedCount: number | undefined,
  versionLabels: Array<string | undefined>,
): number {
  if (typeof storedCount === 'number' && storedCount >= 1) {
    return storedCount;
  }
  if (versionLabels.length > 0) return versionLabels.length;
  return 1;
}
