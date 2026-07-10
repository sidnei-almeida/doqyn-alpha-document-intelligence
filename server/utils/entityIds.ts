export const DOCUMENT_CATEGORY_ID_PREFIX = 'cat_';
export const DOCUMENT_GROUP_ID_PREFIX = 'group_';

export function isDocumentCategoryId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith(DOCUMENT_CATEGORY_ID_PREFIX));
}

export function isDocumentGroupId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith(DOCUMENT_GROUP_ID_PREFIX));
}
