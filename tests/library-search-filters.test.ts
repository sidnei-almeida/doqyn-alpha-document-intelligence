import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildDocumentSearchOrClause,
  buildDocumentTypeClause,
  escapeRegexLiteral,
  resolveDocumentListSort,
} from '../server/utils/documentListQuery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('documentListQuery (backend)', () => {
  it('escapeRegexLiteral limita tamanho e escapa metacaracteres', () => {
    assert.equal(escapeRegexLiteral('a+b'), 'a\\+b');
    assert.equal(escapeRegexLiteral('x'.repeat(200)).length, 120);
  });

  it('buildDocumentSearchOrClause cobre campos de nome e metadados isolados', () => {
    const clause = buildDocumentSearchOrClause('nda');
    const fields = clause.map((entry) => Object.keys(entry)[0]);
    for (const field of [
      'currentFileName',
      'originalFileName',
      'recommendedFileName',
      'className',
      'ownerName',
      'searchMeta.people.name',
      'searchMeta.people.nameNormalized',
      'searchMeta.documentTitle',
    ]) {
      assert.ok(fields.includes(field), `campo ${field} pesquisável`);
    }
    assert.equal(fields.includes('metadata.tags'), false);
  });

  it('buildDocumentTypeClause diferencia pdf, image e other', () => {
    assert.ok(buildDocumentTypeClause('pdf'));
    assert.ok(buildDocumentTypeClause('image'));
    assert.ok(buildDocumentTypeClause('other'));
    assert.equal(buildDocumentTypeClause('docx'), null);
  });

  it('resolveDocumentListSort rejeita campos inválidos com fallback seguro', () => {
    assert.deepEqual(resolveDocumentListSort('updatedAt', 'desc'), {
      field: 'updatedAt',
      direction: -1,
    });
    assert.deepEqual(resolveDocumentListSort('name', 'asc'), {
      field: 'currentFileName',
      direction: 1,
    });
    assert.deepEqual(resolveDocumentListSort('invalid', 'sideways'), {
      field: 'updatedAt',
      direction: -1,
    });
  });
});

describe('busca e filtros da Biblioteca (frontend)', () => {
  const srcRoot = join(__dirname, '..', 'src');

  function readSrc(relativePath: string): string {
    return readFileSync(join(srcRoot, relativePath), 'utf8');
  }

  it('GlobalSearchCommand usa debounce e sincroniza ?q= na URL', () => {
    const search = readSrc('components/layout/GlobalSearchCommand.tsx');
    assert.ok(search.includes('useDebouncedValue'));
    assert.ok(search.includes("next.set('q'"));
    assert.ok(search.includes("next.delete('q'"));
    assert.ok(search.includes('Escape'));
  });

  it('useLibraryRouteState persiste q, filtros, sort e direction', () => {
    const route = readSrc('features/library/hooks/useLibraryRouteState.ts');
    for (const key of ['q', 'status', 'type', 'period', 'owner', 'scope', 'sort', 'direction', 'view']) {
      assert.ok(route.includes(`'${key}'`), `param ${key}`);
    }
    assert.ok(route.includes('clearFilters'));
  });

  it('buildLibraryDocumentFilters mapeia Processado para active + processingStatus', () => {
    const utils = readSrc('features/library/utils/libraryFilterUtils.ts');
    assert.ok(utils.includes("case 'processed'"));
    assert.ok(utils.includes("processingStatus: 'processed'"));
    assert.ok(utils.includes("status: 'active'"));
  });

  it('useDocuments serializa filtros na query key com escopo de listagem', () => {
    const hook = readSrc('features/documents/hooks/useDocuments.ts');
    assert.ok(hook.includes('serializeDocumentFilters'));
    assert.ok(hook.includes('listScopeKey'));
    assert.ok(hook.includes("['documents', tenantId, userId, serialized, listScopeKey]"));
  });

  it('ExplorerToolbarActions expõe filtros de tipo, período e proprietário', () => {
    const actions = readSrc('features/library/components/ExplorerToolbarActions.tsx');
    assert.ok(actions.includes('TypeFilterMenu'));
    assert.ok(actions.includes('PeriodFilterMenu'));
    assert.ok(actions.includes('OwnerFilterMenu'));
  });

  it('ActiveFilterChips permite limpar filtros ativos', () => {
    const chips = readSrc('features/library/components/ActiveFilterChips.tsx');
    assert.ok(chips.includes('Limpar filtros'));
    assert.ok(chips.includes('hasActiveLibraryFilters'));
  });

  it('api documents repassa sort, direction, owner e processingStatus', () => {
    const api = readFileSync(join(__dirname, '..', 'api', 'documents', 'index.ts'), 'utf8');
    for (const key of ['sort', 'direction', 'owner', 'processingStatus', 'excludeArchived']) {
      assert.ok(api.includes(key), `query ${key}`);
    }
  });

  it('useLibraryExplorerMode trata qualquer filtro ativo na raiz como modo busca', () => {
    const mode = readSrc('features/library/hooks/useLibraryExplorerMode.ts');
    assert.ok(mode.includes('hasActiveLibraryFilters'));
  });
});
