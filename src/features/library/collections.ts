import type { DocumentListItem } from '@/types/document-library';

export type LibraryCollectionId =
  | 'root'
  | 'compartilhados'
  | 'para-assinar'
  | 'recentes'
  | 'favoritos'
  | 'lixeira';

export type LibraryCollection = {
  id: LibraryCollectionId;
  slug: string;
  label: string;
  description: string;
  /** Filtro aplicado sobre listDocuments — nunca inventa dados, só recorta. */
  emptyTitle: string;
  emptyDescription: string;
  showFolders: boolean;
};

export const LIBRARY_COLLECTIONS: Record<LibraryCollectionId, LibraryCollection> = {
  root: {
    id: 'root',
    slug: '',
    label: 'Biblioteca',
    description: 'Todos os documentos e espaços deste ambiente.',
    emptyTitle: 'Esta biblioteca ainda está vazia',
    emptyDescription:
      'Envie seu primeiro documento para o DOQYN analisar, classificar e preparar para revisão.',
    showFolders: true,
  },
  compartilhados: {
    id: 'compartilhados',
    slug: 'compartilhados',
    label: 'Compartilhados comigo',
    description: 'Documentos enviados por outras pessoas aos quais você tem acesso.',
    emptyTitle: 'Nada compartilhado com você ainda',
    emptyDescription:
      'Quando alguém compartilhar um documento com você, ele aparecerá aqui.',
    showFolders: false,
  },
  'para-assinar': {
    id: 'para-assinar',
    slug: 'assinaturas',
    label: 'Para assinar',
    description: 'Documentos que aguardam sua assinatura eletrônica.',
    emptyTitle: 'Nenhum documento pendente de assinatura.',
    emptyDescription:
      'Quando alguém solicitar sua assinatura, a solicitação aparecerá aqui.',
    showFolders: false,
  },
  recentes: {
    id: 'recentes',
    slug: 'recentes',
    label: 'Recentes',
    description: 'Os documentos atualizados mais recentemente neste ambiente.',
    emptyTitle: 'Nenhuma atividade recente',
    emptyDescription: 'Os documentos atualizados nos últimos dias aparecem aqui.',
    showFolders: false,
  },
  favoritos: {
    id: 'favoritos',
    slug: 'favoritos',
    label: 'Favoritos',
    description: 'Seus documentos marcados com estrela, para acesso rápido.',
    emptyTitle: 'Nenhum documento favorito',
    emptyDescription: 'Marque documentos com estrela para encontrá-los rapidamente.',
    showFolders: false,
  },
  lixeira: {
    id: 'lixeira',
    slug: 'lixeira',
    label: 'Lixeira',
    description: 'Documentos excluídos neste ambiente. Restaure ou remova permanentemente.',
    emptyTitle: 'A lixeira está vazia',
    emptyDescription: 'Documentos excluídos aparecem aqui antes de qualquer remoção definitiva.',
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
 * - lixeira: GET /api/trash/documents (deletedAt != null, não purgados).
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
      return documents;
    default:
      return documents;
  }
}
