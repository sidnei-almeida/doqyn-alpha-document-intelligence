import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildLibraryDocumentFilters, libraryListScopeKey } from '../src/features/library/utils/libraryFilterUtils';
import {
  findLibraryCategory,
  resolveLibraryCategoryId,
} from '../src/features/library/utils/resolveLibraryCategory';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

const CATEGORIES = [
  { id: 'cat_juridico', name: 'Jurídico', slug: 'juridico' },
  { id: 'cat_financeiro', name: 'Financeiro', slug: 'financeiro' },
];

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('resolveLibraryCategoryId', () => {
  it('resolve slug juridico para cat_juridico', () => {
    assert.equal(resolveLibraryCategoryId('juridico', CATEGORIES), 'cat_juridico');
  });

  it('mantém id canônico cat_juridico', () => {
    assert.equal(resolveLibraryCategoryId('cat_juridico', CATEGORIES), 'cat_juridico');
  });

  it('rejeita ID de grupo documental como pasta', () => {
    assert.equal(resolveLibraryCategoryId('group_juridico', CATEGORIES), undefined);
    assert.equal(resolveLibraryCategoryId('group_financeiro', CATEGORIES), undefined);
  });

  it('não faz fallback com ID desconhecido', () => {
    assert.equal(resolveLibraryCategoryId('not_a_real_id', CATEGORIES), undefined);
  });

  it('resolve nome Jurídico quando único na lista', () => {
    assert.equal(resolveLibraryCategoryId('Jurídico', CATEGORIES), 'cat_juridico');
  });

  it('findLibraryCategory retorna categoria pelo slug', () => {
    const match = findLibraryCategory('juridico', CATEGORIES);
    assert.equal(match?.id, 'cat_juridico');
    assert.equal(match?.name, 'Jurídico');
  });
});

describe('buildLibraryDocumentFilters — pasta Jurídico', () => {
  const baseState = {
    space: 'juridico',
    q: '',
    view: 'grid' as const,
    sort: 'updatedAt' as const,
    direction: 'desc' as const,
    status: '',
    type: '' as const,
    period: '' as const,
    owner: '' as const,
    scope: '' as const,
  };

  it('documento com slug na URL usa categoryId real na API', () => {
    const filters = buildLibraryDocumentFilters({
      state: baseState,
      collectionId: 'root',
      categories: CATEGORIES,
    });
    assert.equal(filters.categoryId, 'cat_juridico');
  });

  it('status Todos não aplica processingStatus', () => {
    const filters = buildLibraryDocumentFilters({
      state: baseState,
      collectionId: 'root',
      categories: CATEGORIES,
    });
    assert.equal(filters.processingStatus, undefined);
    assert.equal(filters.status, undefined);
  });

  it('filtro Processado não esconde active indevidamente no mapeamento', () => {
    const filters = buildLibraryDocumentFilters({
      state: { ...baseState, status: 'processed' },
      collectionId: 'root',
      categories: CATEGORIES,
    });
    assert.equal(filters.status, 'active');
    assert.equal(filters.processingStatus, 'processed');
  });

  it('busca em toda biblioteca remove categoryId quando scope=all', () => {
    const filters = buildLibraryDocumentFilters({
      state: { ...baseState, q: 'nda', scope: 'all' },
      collectionId: 'root',
      categories: CATEGORIES,
    });
    assert.equal(filters.categoryId, undefined);
    assert.equal(filters.search, 'nda');
  });

  it('query scope key muda entre raiz e pasta', () => {
    const root = buildLibraryDocumentFilters({
      state: { ...baseState, space: '' },
      collectionId: 'root',
      categories: CATEGORIES,
    });
    const folder = buildLibraryDocumentFilters({
      state: baseState,
      collectionId: 'root',
      categories: CATEGORIES,
    });
    assert.notEqual(libraryListScopeKey(root), libraryListScopeKey(folder));
  });
});

describe('integração Biblioteca — pasta e cache', () => {
  it('useLibraryView normaliza slug e passa categorias ao builder', () => {
    const view = readSrc('features/library/hooks/useLibraryView.ts');
    assert.ok(view.includes('resolveLibraryCategoryId'));
    assert.ok(view.includes('useDocumentCategories'));
    assert.ok(view.includes('buildLibraryDocumentFilters'));
    assert.ok(view.includes('resolvedSpaceId !== state.space'));
  });

  it('useDocuments inclui listScopeKey na query key', () => {
    const hook = readSrc('features/documents/hooks/useDocuments.ts');
    assert.ok(hook.includes('listScopeKey'));
    assert.equal(hook.includes('keepPreviousData'), false);
  });

  it('abrir pasta limpa filtros contaminantes', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes("status: ''"));
    assert.ok(page.includes("scope: ''"));
    assert.ok(page.includes('findLibraryCategory'));
  });

  it('thumbnail com falha não remove card', () => {
    const thumb = readSrc('features/documents/preview/DocumentThumbnail.tsx');
    assert.ok(thumb.includes('FileTypeIcon'));
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.equal(card.includes('canPreview === false') && card.includes('return null'), false);
  });

  it('listagem não exige canPreview — regras de governança cobrem view e download', () => {
    const access = readFileSync(
      join(__dirname, '..', 'server', 'tenancy', 'documentAccess.ts'),
      'utf8',
    );
    assert.ok(access.includes('userHasGovernanceCategoryPermission'));
    assert.ok(access.includes("'download'"));
    assert.ok(access.includes('canUserListDocument'));
  });

  it('backend trata processed e processed_with_review no filtro Processado', () => {
    const service = readFileSync(
      join(__dirname, '..', 'server', 'services', 'documentService.ts'),
      'utf8',
    );
    assert.ok(service.includes("processingStatus === 'processed'"));
    assert.ok(service.includes('processed_with_review'));
  });
});
