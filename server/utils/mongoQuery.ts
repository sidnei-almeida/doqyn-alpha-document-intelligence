/**
 * Consulta nova com o escopo de tenant como primeiro item de `$and`.
 *
 * O escopo não fica espalhado no topo do objeto porque ali qualquer filtro posterior com a mesma
 * chave o substitui — `$or` de busca, `ownerUserId` do filtro "de outros". Dentro de `$and`, nenhuma
 * atribuição de campo alcança o escopo, e o planner do Mongo usa os mesmos índices.
 */
export function scopedQuery(scope: Record<string, unknown>): Record<string, unknown> {
  return { $and: [{ ...scope }] };
}

/**
 * Acrescenta uma condição a `$and` sem apagar as que já estão lá.
 *
 * Existe para que ninguém atribua `$or` direto no topo de uma consulta já escopada. Chave de topo
 * repetida sobrescreve em silêncio: o escopo de tenant, uma busca e um filtro de tipo que usam
 * `$or` não podem dividir o mesmo nível do objeto. Dentro de `$and`, cada um fica no seu item.
 */
export function addAndClause(
  query: Record<string, unknown>,
  clause: Record<string, unknown> | null | undefined,
): void {
  if (!clause || Object.keys(clause).length === 0) return;
  const current = Array.isArray(query.$and) ? (query.$and as Record<string, unknown>[]) : [];
  query.$and = [...current, clause];
}
