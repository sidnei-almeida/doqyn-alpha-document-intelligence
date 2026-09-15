import { escapeRegexLiteral } from '../../utils/documentListQuery.js';
import { addAndClause, scopedQuery } from '../../utils/mongoQuery.js';

export const TRASH_DOCUMENT_FILTER = {
  deletedAt: { $ne: null, $exists: true },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

export const DEACTIVATED_DOCUMENT_FILTER = {
  lifecycleStatus: 'deactivated',
  deactivatedAt: { $ne: null, $exists: true },
};

function titleSearchClause(search?: string): Record<string, unknown> | null {
  if (!search?.trim()) return null;
  const term = escapeRegexLiteral(search);
  return {
    $or: [
      { title: { $regex: term, $options: 'i' } },
      { currentFileName: { $regex: term, $options: 'i' } },
      { className: { $regex: term, $options: 'i' } },
    ],
  };
}

/**
 * Lixeira. A busca gravava `query.$or` por cima do `$or` do escopo de tenant, e o admin via a
 * lixeira de todos os tenants. Escopo e busca agora ficam em itens separados de `$and`.
 */
export function buildTrashListQuery(
  scope: Record<string, unknown>,
  search?: string,
): Record<string, unknown> {
  const query: Record<string, unknown> = { ...scopedQuery(scope), ...TRASH_DOCUMENT_FILTER };
  addAndClause(query, titleSearchClause(search));
  return query;
}

/** Desativados — mesmo defeito e mesma correção da lixeira. */
export function buildDeactivatedListQuery(
  scope: Record<string, unknown>,
  search?: string,
): Record<string, unknown> {
  const query: Record<string, unknown> = { ...scopedQuery(scope), ...DEACTIVATED_DOCUMENT_FILTER };
  addAndClause(query, titleSearchClause(search));
  return query;
}
