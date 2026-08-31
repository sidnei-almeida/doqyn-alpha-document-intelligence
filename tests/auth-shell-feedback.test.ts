import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('auth shell e feedback', () => {
  // O rebrand trocou a casca: `AuthSplitShell` virou rota de layout, então as telas não a
  // mencionam — recebem `AuthHeading` dela e nada mais. E a marca deixou de ser PNG por tema:
  // é `DoqynMark` em SVG com `currentColor`, desenhada uma vez pela casca.
  it('telas públicas herdam a casca e não desenham a própria marca', () => {
    const login = read('src/pages/Login.tsx');
    const access = read('src/features/access-request/AccessChoicePage.tsx');

    for (const [name, source] of [
      ['Login', login],
      ['AccessChoicePage', access],
    ] as const) {
      assert.ok(
        source.includes("from '@/components/layout/AuthSplitShell'"),
        `${name} deve usar os títulos da casca`,
      );
      assert.equal(source.includes('DoqynLogo'), false, `${name} não desenha logo próprio`);
      assert.equal(source.includes('AuthBrandLogo'), false, `${name} não desenha logo próprio`);
    }

    // A casca é aplicada como rota de layout, e é ela quem desenha a marca.
    const routes = read('src/app/routes.tsx');
    assert.ok(routes.includes('element: <AuthSplitShell />'));

    const shell = read('src/components/layout/AuthSplitShell.tsx');
    assert.ok(shell.includes('DoqynMark'));
  });

  it('expõe componentes de erro minimalistas no design system', () => {
    const index = read('src/components/ui/index.ts');
    assert.ok(index.includes('AlertBanner'));
    assert.ok(index.includes('InlineErrorHint'));
    assert.ok(index.includes('AppErrorBoundary'));
  });

  it('UsersPage distingue erro de carregamento de lista vazia', () => {
    const users = read('src/features/users/UsersPage.tsx');
    assert.ok(users.includes('membersQuery.isError'));
    assert.ok(users.includes('InlineErrorHint'));
  });
});
