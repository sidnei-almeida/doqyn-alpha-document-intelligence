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

/**
 * Resolve ?space= para o categoryId real usado em listDocuments (classId no Mongo).
 * Aceita id canônico (cat_juridico), slug (juridico) ou nome (Jurídico).
 */
export function resolveLibraryCategoryId(
  space: string,
  categories: readonly LibraryCategoryRef[],
): string | undefined {
  const trimmed = space.trim();
  if (!trimmed) return undefined;

  const byId = categories.find((category) => category.id === trimmed);
  if (byId) return byId.id;

  const normalized = normalizeCategoryKey(trimmed);

  const bySlug = categories.find(
    (category) => category.slug && normalizeCategoryKey(category.slug) === normalized,
  );
  if (bySlug) return bySlug.id;

  const byName = categories.find((category) => normalizeCategoryKey(category.name) === normalized);
  if (byName) return byName.id;

  return trimmed;
}

export function findLibraryCategory(
  space: string,
  categories: readonly LibraryCategoryRef[],
): LibraryCategoryRef | undefined {
  const resolvedId = resolveLibraryCategoryId(space, categories);
  if (!resolvedId) return undefined;
  return categories.find((category) => category.id === resolvedId);
}
