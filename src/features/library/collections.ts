import type { DocumentListItem } from '@/types/document-library';

export type LibraryCollectionId =
  | 'root'
  | 'compartilhados'
  | 'para-assinar'
  | 'recentes'
  | 'favoritos'
  | 'lixeira'
  | 'desativados';

/**
 * A coleção é dado de roteamento, não texto de tela.
 *
 * O `slug` é o segmento da URL, em inglês como o resto das rotas; o `id` continua o identificador
 * interno de sempre. O slug antigo em português redireciona (`src/app/legacyRoutes.ts`).
 *
 * Mesma separação de `src/lib/constants.ts`: o que fica aqui é o identificador, o slug da URL e
 * a decisão de mostrar pastas. As quatro frases — rótulo, descrição e o par de estado vazio —
 * moram em `library.json` sob `collections.<id>`, e quem renderiza resolve com `t`. Resolver
 * aqui congelaria o idioma no momento do import, porque este objeto é constante de módulo.
 */
export type LibraryCollection = {
  id: LibraryCollectionId;
  slug: string;
  labelKey: string;
  descriptionKey: string;
  /** Filtro aplicado sobre listDocuments — nunca inventa dados, só recorta. */
  emptyTitleKey: string;
  emptyDescriptionKey: string;
  showFolders: boolean;
};

export const LIBRARY_COLLECTIONS: Record<LibraryCollectionId, LibraryCollection> = {
  root: {
    id: 'root',
    slug: '',
    labelKey: 'library:collections.root.label',
    descriptionKey: 'library:collections.root.description',
    emptyTitleKey: 'library:collections.root.emptyTitle',
    emptyDescriptionKey: 'library:collections.root.emptyDescription',
    showFolders: true,
  },
  compartilhados: {
    id: 'compartilhados',
    slug: 'shared',
    labelKey: 'library:collections.compartilhados.label',
    descriptionKey: 'library:collections.compartilhados.description',
    emptyTitleKey: 'library:collections.compartilhados.emptyTitle',
    emptyDescriptionKey: 'library:collections.compartilhados.emptyDescription',
    showFolders: false,
  },
  'para-assinar': {
    id: 'para-assinar',
    slug: 'signatures',
    labelKey: 'library:collections.paraAssinar.label',
    descriptionKey: 'library:collections.paraAssinar.description',
    emptyTitleKey: 'library:collections.paraAssinar.emptyTitle',
    emptyDescriptionKey: 'library:collections.paraAssinar.emptyDescription',
    showFolders: false,
  },
  recentes: {
    id: 'recentes',
    slug: 'recent',
    labelKey: 'library:collections.recentes.label',
    descriptionKey: 'library:collections.recentes.description',
    emptyTitleKey: 'library:collections.recentes.emptyTitle',
    emptyDescriptionKey: 'library:collections.recentes.emptyDescription',
    showFolders: false,
  },
  favoritos: {
    id: 'favoritos',
    slug: 'favorites',
    labelKey: 'library:collections.favoritos.label',
    descriptionKey: 'library:collections.favoritos.description',
    emptyTitleKey: 'library:collections.favoritos.emptyTitle',
    emptyDescriptionKey: 'library:collections.favoritos.emptyDescription',
    showFolders: false,
  },
  lixeira: {
    id: 'lixeira',
    slug: 'trash',
    labelKey: 'library:collections.lixeira.label',
    descriptionKey: 'library:collections.lixeira.description',
    emptyTitleKey: 'library:collections.lixeira.emptyTitle',
    emptyDescriptionKey: 'library:collections.lixeira.emptyDescription',
    showFolders: false,
  },
  desativados: {
    id: 'desativados',
    slug: 'deactivated',
    labelKey: 'library:collections.desativados.label',
    descriptionKey: 'library:collections.desativados.description',
    emptyTitleKey: 'library:collections.desativados.emptyTitle',
    emptyDescriptionKey: 'library:collections.desativados.emptyDescription',
    showFolders: false,
  },
};

const RECENT_LIMIT = 50;

export { RECENT_LIMIT };

export function resolveCollection(slug: string | undefined): LibraryCollection {
  if (!slug) return LIBRARY_COLLECTIONS.root;
  const match = Object.values(LIBRARY_COLLECTIONS).find((entry) => entry.slug === slug);
  return match ?? LIBRARY_COLLECTIONS.root;
}

/**
 * Recorta a listagem real conforme a coleção ativa.
 * - compartilhados: GET /api/shared-with-me/documents;
 * - recentes: últimos atualizados (limite fixo);
 * - favoritos: carregados via GET /api/favorites/documents (preferência por userId);
 * - lixeira: GET /api/trash/documents;
 * - desativados: GET /api/deactivated/documents (admin+).
 */
export function applyCollectionFilter(
  documents: DocumentListItem[],
  collection: LibraryCollection,
  context: { currentUserId?: string },
): DocumentListItem[] {
  switch (collection.id) {
    case 'compartilhados':
      return documents.filter((doc) => {
        const ownerId = doc.createdBy?.userId ?? doc.ownerUserId;
        return Boolean(ownerId) && ownerId !== context.currentUserId;
      });
    case 'recentes':
      return documents;
    case 'favoritos':
      return documents.filter((doc) => doc.isFavorite === true);
    case 'lixeira':
    case 'desativados':
      return documents;
    default:
      return documents;
  }
}
