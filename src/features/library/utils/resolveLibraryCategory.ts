import {
  isDocumentCategoryId,
  isDocumentGroupId,
  isLegacyExtractionClassId,
} from '../../../lib/entityIds';

export type LibraryCategoryRef = {
  id: string;
  name: string;
  slug?: string;
};

function normalizeCategoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function resolveUniqueCategoryMatch(
  matches: readonly LibraryCategoryRef[],
): LibraryCategoryRef | undefined {
  if (matches.length === 1) return matches[0];
  return undefined;
}

/**
 * Resolve ?space= para o categoryId real usado em listDocuments (classId no Mongo).
 * Aceita apenas IDs de categoria (cat_*) ou slug/nome **quando único** na lista de categorias.
 * Nunca trata group_* como categoria — grupos e classes podem ter o mesmo nome.
 */
export function resolveLibraryCategoryId(
  space: string,
  categories: readonly LibraryCategoryRef[],
): string | undefined {
  const trimmed = space.trim();
  if (!trimmed) return undefined;

  if (isDocumentGroupId(trimmed)) return undefined;

  if (isDocumentCategoryId(trimmed) || isLegacyExtractionClassId(trimmed)) {
    return categories.find((category) => category.id === trimmed)?.id;
  }

  const normalized = normalizeCategoryKey(trimmed);

  const bySlug = categories.filter(
    (category) => category.slug && normalizeCategoryKey(category.slug) === normalized,
  );
  const slugMatch = resolveUniqueCategoryMatch(bySlug);
  if (slugMatch) return slugMatch.id;

  const byName = categories.filter(
    (category) => normalizeCategoryKey(category.name) === normalized,
  );
  const nameMatch = resolveUniqueCategoryMatch(byName);
  if (nameMatch) return nameMatch.id;

  return undefined;
}

export function findLibraryCategory(
  space: string,
  categories: readonly LibraryCategoryRef[],
): LibraryCategoryRef | undefined {
  const resolvedId = resolveLibraryCategoryId(space, categories);
  if (!resolvedId) return undefined;
  return categories.find((category) => category.id === resolvedId);
}
