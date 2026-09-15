import { isUncategorizedCategory, type CategoryRef } from '@shared/systemCategory';
import { i18n } from '@/i18n';

/**
 * O nome de categoria que a tela mostra.
 *
 * Categoria criada pelo tenant é dado dele e aparece como foi escrita. A classe de sistema
 * "Sem categoria" nasce com o nome gravado em português — então, reconhecida pela chave, sai no
 * idioma de quem lê. Usa o `common`, que vem embutido: o nome é trocado no fetch, antes de
 * qualquer catálogo de feature ter chegado.
 */
export function categoryDisplayName(
  name: string | undefined,
  ref: Omit<CategoryRef, 'name'> = {},
): string | undefined {
  if (!name && !ref.id && !ref.slug) return name;
  return isUncategorizedCategory({ ...ref, name }) ? i18n.t('common:uncategorized') : name;
}

/** Categoria de uma lista (`/api/document-categories`) com o nome já no idioma da tela. */
export function withCategoryDisplayName<T extends { id: string; name: string; slug?: string }>(
  category: T,
): T {
  return { ...category, name: categoryDisplayName(category.name, category) ?? category.name };
}
