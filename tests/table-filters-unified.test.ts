import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('tabela e filtros unificados', () => {
  it('FilterBar usa grid responsivo com campos de altura uniforme', () => {
    const source = readSrc('components/ui/FilterBar.tsx');
    assert.ok(source.includes('lg:grid-cols-4'));
    assert.ok(source.includes('FilterBarField'));
    assert.ok(source.includes('sm:col-span-2'));
  });

  it('DataTable tem cabeçalho diferenciado, hover e rodapé esparso', () => {
    const source = readSrc('components/ui/DataTable.tsx');
    assert.ok(source.includes('bg-doqyn-card'));
    assert.ok(source.includes('border-doqyn-border'));
    assert.ok(source.includes('hover:bg-doqyn-surface-hover'));
    assert.ok(source.includes('py-3.5'));
    assert.ok(source.includes('sparseMessage'));
    assert.ok(source.includes('footer'));
  });

  it('Documentos, Usuários e Tracking usam FilterBar e DataTable', () => {
    const pages = [
      'features/documents/DocumentsPage.tsx',
      'features/users/UsersPage.tsx',
      'features/tracking/TrackingPage.tsx',
    ];

    for (const page of pages) {
      const source = readSrc(page);
      const usesFilterBar =
        source.includes('FilterBar') ||
        (page.includes('tracking') && readSrc('features/tracking/components/TrackingFilters.tsx').includes('FilterBar'));
      assert.ok(usesFilterBar, `${page} deve usar FilterBar`);
      assert.ok(
        source.includes('DataTable') || source.includes('TrackingEventsTable'),
        `${page} deve usar DataTable`,
      );
    }
  });

  it('Usuários renderiza roles como chips e menu de ações', () => {
    const source = readSrc('features/users/UsersPage.tsx');
    assert.ok(source.includes('PlatformRoleChips'));
    assert.ok(source.includes('TableRowActionsMenu'));
    assert.equal(source.includes('formatPlatformRoles'), false);
  });

  it('TrackingFilters usa FilterBar e DateInput', () => {
    const source = readSrc('features/tracking/components/TrackingFilters.tsx');
    assert.ok(source.includes('FilterBar'));
    assert.ok(source.includes('DateInput'));
    assert.equal(source.includes('grid gap-3 md:grid-cols-2'), false);
  });
});
