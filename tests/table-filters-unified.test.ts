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
    const globals = readSrc('styles/globals.css');
    // O cabeçalho deixou de ser faixa preenchida e virou fio: "linha, não caixa". E o hover da
    // linha virou régua de acento à esquerda, em vez de troca de fundo.
    assert.equal(source.includes('bg-doqyn-card'), false);
    assert.ok(source.includes('border-b border-doqyn-border-subtle'));
    assert.ok(source.includes('data-table-row'));
    assert.ok(globals.includes('box-shadow: inset 2px 0 0 var(--accent-active)'));
    assert.ok(source.includes('sparseMessage'));
    assert.ok(source.includes('footer'));
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
