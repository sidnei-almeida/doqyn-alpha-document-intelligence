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

describe('navegação da Biblioteca', () => {
  it('/library é rota registrada com LibraryRoute', () => {
    const routes = readSrc('app/routes.tsx');
    assert.ok(routes.includes("path: '/library'"));
    assert.ok(routes.includes('LibraryRoute'));
  });

  it('/documents redireciona para /library', () => {
    const routes = readSrc('app/routes.tsx');
    assert.ok(routes.includes("path: '/documents'"));
    assert.match(routes, /\/documents'[^}]*Navigate to="\/library"/);
  });

  it('rota raiz e fallback apontam para /library, não /upload', () => {
    const routes = readSrc('app/routes.tsx');
    assert.match(routes, /path: '\/'[^}]*\/library/);
    assert.match(routes, /path: '\*'[^}]*\/library/);
    assert.equal(routes.includes('Navigate to="/upload"'), false);
  });

  it('/upload deixou de existir: o envio vive só na Biblioteca', () => {
    const routes = readSrc('app/routes.tsx');
    assert.equal(routes.includes("path: '/upload'"), false);
    assert.equal(routes.includes('DocumentSendRoute'), false);
  });

  it('nav primária tem Biblioteca e não tem Envio de Documentos nem /documents', () => {
    const constants = readSrc('lib/constants.ts');
    assert.match(constants, /NAV_ITEMS_PRIMARY[\s\S]*?\/library/);
    const primaryBlock = constants.slice(
      constants.indexOf('NAV_ITEMS_PRIMARY'),
      constants.indexOf('NAV_ITEMS_ADMIN'),
    );
    assert.equal(primaryBlock.includes('/upload'), false);
    assert.equal(primaryBlock.includes('/documents'), false);
  });

  it('Visão Geral foi rebaixada para o grupo de administração', () => {
    const constants = readSrc('lib/constants.ts');
    const adminBlock = constants.slice(constants.indexOf('NAV_ITEMS_ADMIN'));
    assert.ok(adminBlock.includes('/dashboard'));
    assert.ok(adminBlock.includes('nav.dashboard'));
  });

  it('login autenticado e guards de rota levam a /library', () => {
    const protectedRoute = readSrc('features/auth/ProtectedRoute.tsx');
    const trackingRoute = readSrc('features/tracking/TrackingRoute.tsx');
    const usersRoute = readSrc('features/users/UserManagementRoute.tsx');
    const rulesRoute = readSrc('features/rules/RulesRoute.tsx');
    assert.ok(protectedRoute.includes('Navigate to="/library"'));
    assert.ok(trackingRoute.includes('Navigate to="/library"'));
    assert.ok(usersRoute.includes('Navigate to="/library"'));
    assert.ok(rulesRoute.includes('Navigate to="/library"'));
    assert.ok(rulesRoute.includes('canAccessRulesPage'));
    assert.equal(protectedRoute.includes('/upload'), false);
  });
});
