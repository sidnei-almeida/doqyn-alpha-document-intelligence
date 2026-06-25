export function removeAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function sanitizeFileNameSegment(value: string, fallback: string): string {
  const normalized = removeAccents(value)
    .replace(/[/\\;]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

  return normalized || fallback;
}

export function ensurePdfExtension(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '');
  return `${base}.pdf`;
}

export function limitFileNameLength(fileName: string, maxLength = 180): string {
  if (fileName.length <= maxLength) return fileName;
  const ext = '.pdf';
  const base = fileName.slice(0, maxLength - ext.length);
  return `${base}${ext}`;
}
