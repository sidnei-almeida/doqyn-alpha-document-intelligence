import type { CollationOptions } from 'mongodb';
import { addAndClause, scopedQuery } from './mongoQuery.js';
import { TEXT_SORT_COLLATION } from './textCollation.js';

/** Escapa termo de busca para regex seguro (evita ReDoS por metacaracteres). */
export function escapeRegexLiteral(input: string, maxLength = 120): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type DocumentListQueryFilters = {
  status?: string;
  processingStatus?: string;
  area?: string;
  categoryId?: string;
  excludeArchived?: boolean | string;
  owner?: string;
  ownerUserId?: string;
  search?: string;
  type?: string;
  from?: string;
  to?: string;
};

/**
 * Consulta da biblioteca. Função pura para que o escopo de tenant possa ser provado em teste.
 *
 * Com uma só condição de busca ou de tipo, ela ia para o topo com `Object.assign` — e o `$or` dela
 * apagava o `$or` do escopo. A lista devolvia documentos de todos os tenants. O escopo agora vive em
 * `$and` (ver `scopedQuery`) e toda condição composta entra ao lado dele.
 */
export function buildDocumentListQuery(
  scope: Record<string, unknown>,
  filters: DocumentListQueryFilters,
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    ...scopedQuery(scope),
    deletedAt: { $in: [null, undefined] },
    permanentlyDeletedAt: { $in: [null, undefined] },
    deactivatedAt: { $in: [null, undefined] },
  };
  if (filters.status) query.status = filters.status;
  if (filters.processingStatus) {
    if (filters.processingStatus === 'processed') {
      query.processingStatus = { $in: ['processed', 'processed_with_review'] };
    } else {
      query.processingStatus = filters.processingStatus;
    }
  }
  if (filters.area) query.area = filters.area;
  if (filters.categoryId) query.classId = filters.categoryId;

  if (filters.excludeArchived === true || filters.excludeArchived === 'true') {
    if (!filters.status) {
      query.status = { $ne: 'archived' };
    }
  }

  if (filters.owner === 'me' && filters.ownerUserId) {
    query.ownerUserId = filters.ownerUserId;
  } else if (filters.owner === 'others' && filters.ownerUserId) {
    query.ownerUserId = { $ne: filters.ownerUserId };
  }

  if (filters.search?.trim()) {
    addAndClause(query, { $or: buildDocumentSearchOrClause(filters.search) });
  }
  if (filters.type) {
    addAndClause(query, buildDocumentTypeClause(filters.type));
  }

  if (filters.from?.trim() || filters.to?.trim()) {
    const updatedAt: Record<string, Date> = {};
    if (filters.from?.trim()) {
      updatedAt.$gte = new Date(filters.from.trim());
    }
    if (filters.to?.trim()) {
      updatedAt.$lte = new Date(filters.to.trim());
    }
    query.updatedAt = updatedAt;
  }

  return query;
}

export function foldSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ACCENT_CLASSES: Record<string, string> = {
  a: 'aàáâãäåAÀÁÂÃÄÅ',
  e: 'eèéêëEÈÉÊË',
  i: 'iìíîïIÌÍÎÏ',
  o: 'oòóôõöOÒÓÔÕÖ',
  u: 'uùúûüUÙÚÛÜ',
  c: 'cçCÇ',
  n: 'nñNÑ',
  y: 'yýÿYÝŸ',
};

/**
 * Regex que acha com e sem acento, nos dois sentidos: `sao` acha `São`, e `São` acha `Sao`.
 *
 * O termo é dobrado e cada vogal, `c`, `n` e `y` vira a classe das suas variantes. A alternativa
 * era um campo `searchNormalized` gravado em cada documento — mas ele teria de ser mantido em todo
 * caminho de escrita (envio, confirmação, renomear, trocar categoria, metadado), e um caminho
 * esquecido é busca errada em silêncio. A busca já é `$regex` sem âncora, que não usa índice: a
 * classe de caractere não piora o custo. As maiúsculas acentuadas vão explícitas porque o `i` do
 * Mongo não garante caixa em caractere fora do ASCII.
 */
export function buildAccentInsensitivePattern(term: string, maxLength = 120): string {
  const folded = foldSearchText(term.trim().slice(0, maxLength)).replace(/\s+/g, ' ');
  return escapeRegexLiteral(folded, maxLength).replace(
    /[aeioucny]/g,
    (letter) => `[${ACCENT_CLASSES[letter]}]`,
  );
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

const TEXT_SORT_FIELDS = new Set<string>([ALLOWED_SORT_FIELDS.name, ALLOWED_SORT_FIELDS.category]);

/**
 * Collation só quando a ordem é de texto. `status` é código e `ownerUserId` é id: ordená-los com
 * collation não muda nada na tela e tiraria dessas listagens o índice comum que já usam.
 */
export function documentListSortCollation(field: string): CollationOptions | undefined {
  return TEXT_SORT_FIELDS.has(field) ? TEXT_SORT_COLLATION : undefined;
}

/** Campos pesquisáveis no documento (tenant-scoped). */
export function buildDocumentSearchOrClause(term: string): Record<string, unknown>[] {
  // Os campos `*Normalized` já são dobrados na escrita; o mesmo padrão serve a eles e aos crus.
  const regex = { $regex: buildAccentInsensitivePattern(term), $options: 'i' };

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
    // Metadados isolados (busca direcionada — não varrer versions.metadata)
    { 'searchMeta.documentTitle': regex },
    { 'searchMeta.people.name': regex },
    { 'searchMeta.people.nameNormalized': regex },
    { 'searchMeta.people.role': regex },
    { 'searchMeta.people.relatedTo': regex },
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
