export type FileKind = 'pdf' | 'doc' | 'sheet' | 'image' | 'folder' | 'generic';

export type FileTypeVisual = {
  kind: FileKind;
  icon: string;
  toneClass: string;
};

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

export function resolveFileTypeVisual(fileName: string, isFolder = false): FileTypeVisual {
  if (isFolder) {
    return { kind: 'folder', icon: 'folder', toneClass: 'text-doqyn-muted' };
  }

  const ext = extension(fileName);
  if (ext === 'pdf') return { kind: 'pdf', icon: 'picture_as_pdf', toneClass: 'text-doqyn-danger' };
  if (/^(png|jpe?g|gif|webp|svg|bmp)$/.test(ext)) {
    return { kind: 'image', icon: 'image', toneClass: 'text-doqyn-info' };
  }
  if (/^(xlsx?|csv)$/.test(ext)) {
    return { kind: 'sheet', icon: 'table_chart', toneClass: 'text-doqyn-success' };
  }
  if (/^(docx?|rtf|odt)$/.test(ext)) {
    return { kind: 'doc', icon: 'description', toneClass: 'text-doqyn-info' };
  }
  return { kind: 'generic', icon: 'draft', toneClass: 'text-doqyn-muted' };
}

export function isThumbnailCandidate(fileName: string): 'pdf' | 'image' | null {
  const { kind } = resolveFileTypeVisual(fileName);
  if (kind === 'pdf' || kind === 'image') return kind;
  return null;
}
