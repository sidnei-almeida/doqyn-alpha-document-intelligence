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
  it('/biblioteca é rota registrada com LibraryRoute', () => {
    const routes = readSrc('app/routes.tsx');
    assert.ok(routes.includes("path: '/biblioteca'"));
    assert.ok(routes.includes('LibraryRoute'));
  });

  it('/documents redireciona para /biblioteca', () => {
    const routes = readSrc('app/routes.tsx');
    assert.ok(routes.includes("path: '/documents'"));
    assert.match(routes, /\/documents'[^}]*Navigate to="\/biblioteca"/);
  });

  it('rota raiz e fallback apontam para /biblioteca, não /upload', () => {
    const routes = readSrc('app/routes.tsx');
    assert.match(routes, /path: '\/'[^}]*\/biblioteca/);
    assert.match(routes, /path: '\*'[^}]*\/biblioteca/);
    assert.equal(routes.includes('Navigate to="/upload"'), false);
  });

  it('/upload permanece como rota legada acessível', () => {
    const routes = readSrc('app/routes.tsx');
    assert.ok(routes.includes("path: '/upload'"));
    assert.ok(routes.includes('DocumentSendRoute'));
  });

  it('nav primária tem Biblioteca e não tem Envio de Documentos nem /documents', () => {
    const constants = readSrc('lib/constants.ts');
    assert.match(constants, /NAV_ITEMS_PRIMARY[\s\S]*?\/biblioteca/);
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
    assert.ok(adminBlock.includes('Visão Geral'));
  });

  it('login autenticado e guards de rota levam a /biblioteca', () => {
    const protectedRoute = readSrc('features/auth/ProtectedRoute.tsx');
    const trackingRoute = readSrc('features/tracking/TrackingRoute.tsx');
    const usersRoute = readSrc('features/users/UserManagementRoute.tsx');
    assert.ok(protectedRoute.includes('Navigate to="/biblioteca"'));
    assert.ok(trackingRoute.includes('Navigate to="/biblioteca"'));
    assert.ok(usersRoute.includes('Navigate to="/biblioteca"'));
    assert.equal(protectedRoute.includes('/upload'), false);
  });

  it('página legada de envio exibe aviso apontando para a Biblioteca', () => {
    const sendPage = readSrc('features/document-send/DocumentSendPage.tsx');
    assert.ok(sendPage.includes('fluxo legado'));
    assert.ok(sendPage.includes('/biblioteca'));
  });
});
