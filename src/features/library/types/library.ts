import type { DocumentListItem } from '@/types/document-library';

/** Pasta inteligente: categoria/classe do tenant exibida como pasta na Biblioteca. */
export type LibraryFolder = {
  id: string;
  name: string;
  documentCount: number;
  description?: string;
  slug?: string;
};

export type LibraryViewMode = 'list' | 'grid';

export type LibrarySortKey = 'name' | 'updatedAt' | 'status' | 'owner' | 'category';

export type LibrarySelection =
  | { kind: 'file'; document: DocumentListItem }
  | { kind: 'folder'; folder: LibraryFolder }
  | null;

export type LibrarySortDirection = 'asc' | 'desc';

export type LibraryPeriodKey = '' | 'today' | '7d' | '30d' | 'month';

export type LibraryTypeFilter = '' | 'pdf' | 'image' | 'other';

export type LibraryOwnerFilter = '' | 'me' | 'others';

/** Quando em pasta: '' = buscar só na pasta; 'all' = buscar em toda a biblioteca. */
export type LibrarySearchScope = '' | 'all';

export type LibraryRouteState = {
  /** Categoria/espaço ativo (classId). Vazio = raiz da Biblioteca. */
  space: string;
  /** Busca textual vinda da TopBar ou da toolbar. */
  q: string;
  view: LibraryViewMode;
  sort: LibrarySortKey;
  direction: LibrarySortDirection;
  /** Filtro discreto de status na toolbar. */
  status: string;
  type: LibraryTypeFilter;
  period: LibraryPeriodKey;
  owner: LibraryOwnerFilter;
  scope: LibrarySearchScope;
};
