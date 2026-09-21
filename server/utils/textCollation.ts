import type { CollationOptions } from 'mongodb';

/**
 * A ordenação de texto do servidor, numa regra só.
 *
 * `strength: 1` ignora acento e caixa — `Ávila` volta para perto de `Avenida`, e não para depois
 * de `Zebra`, que é onde a ordem por byte o jogava. `numericOrdering` põe `Contrato 2` antes de
 * `Contrato 10`.
 *
 * **Uma collation fixa, e não a do idioma de quem pede.** Índice com collation só serve a consulta
 * com a mesma collation, locale incluído; e a consulta com collation perde o índice comum para os
 * filtros de texto (`tenantId`, `ownerUserId`). Seguir o idioma exigiria um índice por idioma para
 * cada ordenação — e sem eles a listagem vira varredura da coleção, que só aparece sob carga.
 * Neste `strength`, português, espanhol e inglês ordenam igual; a diferença que sobra é o `ñ`, que
 * o espanhol põe depois de `n` e aqui fica junto dele. Limite conhecido.
 */
export const TEXT_SORT_COLLATION: CollationOptions = {
  locale: 'pt',
  strength: 1,
  numericOrdering: true,
};

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * A mesma regra em memória, para lista que já volta inteira do banco — grupos, classes,
 * categorias. Ordenar aqui, e não no Mongo, dispensa índice com collation para coleção pequena.
 */
export function compareNames(a: string | null | undefined, b: string | null | undefined): number {
  return collator.compare(a ?? '', b ?? '');
}
