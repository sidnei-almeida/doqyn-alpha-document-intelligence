/** Escapa termo de busca para regex seguro (evita ReDoS por metacaracteres). */
export function escapeRegexLiteral(input: string, maxLength = 120): string {
  return input.trim().slice(0, maxLength).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ALLOWED_SORT_FIELDS = {
  updatedAt: 'updatedAt',
  name: 'currentFileName',
  status: 'status',
  owner: 'ownerUserId',
  category: 'className',
} as const;

export type DocumentListSortKey = keyof typeof ALLOWED_SORT_FIELDS;

export function resolveDocumentListSort(
  sort?: string,
  direction?: string,
): { field: string; direction: 1 | -1 } {
  const field =
    sort && sort in ALLOWED_SORT_FIELDS
      ? ALLOWED_SORT_FIELDS[sort as DocumentListSortKey]
      : ALLOWED_SORT_FIELDS.updatedAt;
  const dir: 1 | -1 = direction === 'asc' ? 1 : -1;
  return { field, direction: dir };
}

/** Campos pesquisáveis no documento (tenant-scoped). */
export function buildDocumentSearchOrClause(term: string): Record<string, unknown>[] {
  const regex = { $regex: escapeRegexLiteral(term), $options: 'i' };
  return [
    { title: regex },
    { currentFileName: regex },
    { displayName: regex },
    { originalFileName: regex },
    { recommendedFileName: regex },
    { aiSuggestedFileName: regex },
    { finalFileName: regex },
    { className: regex },
    { documentType: regex },
    { ownerName: regex },
    { 'createdBy.displayName': regex },
    { 'createdBy.email': regex },
    { 'metadata.tags': regex },
  ];
}

export function buildDocumentTypeClause(type: string): Record<string, unknown> | null {
  switch (type) {
    case 'pdf':
      return {
        $or: [
          { currentFileName: { $regex: '\\.pdf$', $options: 'i' } },
          { documentType: { $regex: 'pdf', $options: 'i' } },
        ],
      };
    case 'image':
      return {
        $or: [
          { currentFileName: { $regex: '\\.(png|jpe?g|gif|webp|bmp|tiff?)$', $options: 'i' } },
          { documentType: { $regex: 'image', $options: 'i' } },
        ],
      };
    case 'other':
      return {
        $and: [
          { currentFileName: { $not: { $regex: '\\.pdf$', $options: 'i' } } },
          {
            currentFileName: {
              $not: { $regex: '\\.(png|jpe?g|gif|webp|bmp|tiff?)$', $options: 'i' },
            },
          },
        ],
      };
    default:
      return null;
  }
}
