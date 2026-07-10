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
  it('telas públicas usam AuthShell e logo PNG da sidebar', () => {
    const login = read('src/pages/Login.tsx');
    assert.ok(login.includes('AuthShell'));
    assert.ok(login.includes('AuthCard'));
    assert.ok(!login.includes('DoqynLogo'));

    const access = read('src/features/access-request/AccessChoicePage.tsx');
    assert.ok(access.includes('AuthShell'));
    assert.ok(!access.includes('DoqynLogo'));

    const authLogo = read('src/components/brand/AuthBrandLogo.tsx');
    assert.ok(authLogo.includes('sidebarForDarkTheme'));
    assert.ok(authLogo.includes('sidebarForLightTheme'));
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
