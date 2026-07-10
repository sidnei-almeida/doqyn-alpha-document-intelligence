/** Prefixos canônicos — categoria/pasta ≠ grupo/setor de usuários. */
export const DOCUMENT_CATEGORY_ID_PREFIX = 'cat_';
export const DOCUMENT_GROUP_ID_PREFIX = 'group_';
export const LEGACY_EXTRACTION_CLASS_ID_PREFIX = 'class_';

export function isDocumentCategoryId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith(DOCUMENT_CATEGORY_ID_PREFIX));
}

export function isDocumentGroupId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith(DOCUMENT_GROUP_ID_PREFIX));
}

export function isLegacyExtractionClassId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith(LEGACY_EXTRACTION_CLASS_ID_PREFIX));
}

export function assertDocumentCategoryId(id: string, label = 'Categoria'): void {
  if (isDocumentGroupId(id)) {
    throw new Error(
      `${label}: "${id}" é um grupo de usuários (group_*), não uma classe de documentos (cat_*).`,
    );
  }
}

export function assertDocumentGroupId(id: string, label = 'Grupo'): void {
  if (isDocumentCategoryId(id)) {
    throw new Error(
      `${label}: "${id}" é uma classe de documentos (cat_*), não um grupo de usuários (group_*).`,
    );
  }
}

export type CategoryPermissionBuckets = {
  view?: string[];
  download?: string[];
  update?: string[];
  audit?: string[];
  share?: string[];
};

/** União de grupos documentais ligados a uma categoria (qualquer permissão). */
export function collectLinkedDocumentGroupIds(
  permissions: CategoryPermissionBuckets | undefined,
  fallback: string[] = [],
): string[] {
  const ids = new Set<string>();

  if (permissions) {
    for (const bucket of [
      permissions.view,
      permissions.download,
      permissions.update,
      permissions.audit,
      permissions.share,
    ]) {
      for (const groupId of bucket ?? []) {
        if (isDocumentGroupId(groupId)) ids.add(groupId);
      }
    }
  }

  for (const groupId of fallback) {
    if (isDocumentGroupId(groupId)) ids.add(groupId);
  }

  return [...ids];
}
