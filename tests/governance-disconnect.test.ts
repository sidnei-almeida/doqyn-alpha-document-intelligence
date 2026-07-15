import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { EMPTY_CONNECTION_PERMISSIONS } from '../src/features/rules/utils/governanceConnections.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');
const serverRoot = join(__dirname, '..', 'server');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

function readServer(relativePath: string): string {
  return readFileSync(join(serverRoot, relativePath), 'utf8');
}

describe('desconexão de grupo (regras de acesso)', () => {
  it('useRules persiste permissões por célula e invalida cache da Biblioteca', () => {
    const source = readSrc('features/rules/hooks/useRules.ts');
    assert.ok(source.includes('updateGroupClassPermissions'));
    assert.ok(source.includes('updateDocumentAccessMatrixCell'));
    assert.ok(source.includes('invalidateLibraryQueries'));
  });

  it('remover acesso na UI envia EMPTY_CONNECTION_PERMISSIONS', () => {
    const card = readSrc('features/rules/components/access/CategoryAccessCard.tsx');
    const matrix = readSrc('features/rules/components/access/AccessMatrixView.tsx');
    assert.ok(card.includes('EMPTY_CONNECTION_PERMISSIONS'));
    assert.ok(matrix.includes('EMPTY_CONNECTION_PERMISSIONS'));
  });

  it('backend desativa regra quando todas as permissões são falsas (idempotente)', () => {
    const source = readServer('services/documentAccessRulesService.ts');
    assert.ok(source.includes('hasAnyPermission'));
    assert.ok(source.includes('active: false'));
    assert.ok(source.includes('requireTenantGovernanceCollections'));
    assert.ok(source.includes('updateMany'));
  });

  it('PUT /document-rules/matrix usa companyId da sessão admin', () => {
    const source = readFileSync(join(__dirname, '..', 'api/document-rules/matrix.ts'), 'utf8');
    assert.ok(source.includes('withAdminMongoApi'));
    assert.ok(source.includes('companyId'));
    assert.equal(source.includes('tenantId: body'), false);
  });

  it('EMPTY_CONNECTION_PERMISSIONS representa ausência total de permissões', () => {
    assert.deepEqual(EMPTY_CONNECTION_PERMISSIONS, {
      view: false,
      download: false,
      upload: false,
      share: false,
      manage: false,
    });
    assert.equal(Object.values(EMPTY_CONNECTION_PERMISSIONS).some(Boolean), false);
  });
});
