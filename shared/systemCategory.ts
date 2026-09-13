/**
 * A classe de sistema onde cai o documento que ninguém classificou.
 *
 * Nasce na provisão de todo tenant (`ensureUncategorizedCategory`) com o nome gravado em
 * português, e o nome também fica copiado no documento que ela recebe. Por isso a tela não pode
 * confiar no nome: reconhece a classe pela chave técnica — slug ou id — e, para documento antigo
 * que só guardou o nome, pelo nome gravado. Quem mostra troca pela frase do idioma de quem lê.
 *
 * Lista única do front e do servidor: o servidor cria com estes valores, o front os reconhece.
 */
export const UNCATEGORIZED_CATEGORY_SLUG = 'sem-categoria';
export const UNCATEGORIZED_CATEGORY_NAME = 'Sem categoria';

export type CategoryRef = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
};

export function isUncategorizedCategory(ref: CategoryRef): boolean {
  if (ref.slug === UNCATEGORIZED_CATEGORY_SLUG) return true;
  // `createDocumentCategory` monta o id do slug (`cat_sem_categoria`); tenant semeado ganha sufixo.
  if (ref.id && /^cat_sem_categoria(?:__|$)/.test(ref.id)) return true;
  return ref.name?.trim() === UNCATEGORIZED_CATEGORY_NAME;
}
