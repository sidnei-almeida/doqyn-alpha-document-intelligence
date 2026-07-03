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

describe('desconexão visual na linha do mapa (rascunho local)', () => {
  it('useRules expõe disconnectGroupFromCategory para persistência no Salvar', () => {
    const source = readSrc('features/rules/hooks/useRules.ts');
    assert.ok(source.includes('disconnectGroupFromCategory'));
    assert.ok(source.includes('EMPTY_CONNECTION_PERMISSIONS'));
    assert.ok(source.includes('saveGovernanceMapChanges'));
    assert.ok(source.includes('updateDocumentAccessMatrixCell'));
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

  it('ConnectionLines mostra botão × no hover ou seleção da linha', () => {
    const source = readSrc('features/rules/components/governance/ConnectionLines.tsx');
    assert.ok(source.includes('pointer-events-auto cursor-pointer'));
    assert.ok(source.includes('onHoverEdge'));
    assert.ok(source.includes('hovered || selected'));
    assert.ok(source.includes('×'));
    assert.ok(source.includes('Desconectar categoria'));
    assert.ok(source.includes('stroke="transparent"'));
    assert.ok(source.includes('strokeWidth={18}'));
  });

  it('clique na linha seleciona sem abrir sidebar de conexão', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('handleEdgeSelect'));
    assert.ok(source.includes('setSelectedEdgeOnly(edge)'));
    assert.ok(source.includes('setDetailSelection(null)'));
    assert.equal(source.includes("setDetailSelection({ type: 'connection'"), false);
    assert.ok(source.includes('useUnsavedMapChangesGuard'));
  });

  it('Delete/Backspace remove edge apenas do draft', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes("event.key !== 'Delete'"));
    assert.ok(source.includes("event.key !== 'Backspace'"));
    assert.ok(source.includes('isEditableKeyboardTarget'));
    assert.ok(source.includes('performDraftDisconnect'));
    assert.equal(source.includes('performDisconnect'), false);
  });

  it('desconexão no mapa não chama backend imediatamente', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.equal(canvas.includes('await onDisconnect'), false);
    assert.equal(canvas.includes('onDisconnect:'), false);
    assert.ok(canvas.includes('removeEdge'));
  });

  it('desconexão direta não exige modal de confirmação', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const disconnectStart = source.indexOf('const performDraftDisconnect');
    const disconnectBlock = source.slice(disconnectStart, disconnectStart + 600);
    assert.ok(source.includes('performDraftDisconnect'));
    assert.equal(disconnectBlock.includes('confirm('), false);
  });

  it('saveGovernanceMapChanges não remove categoria nem grupo — só a relação', () => {
    const rules = readSrc('features/rules/hooks/useRules.ts');
    const saveStart = rules.indexOf('const saveGovernanceMapChanges');
    const saveEnd = rules.indexOf('const updateCategory', saveStart);
    const saveBlock = rules.slice(saveStart, saveEnd);
    assert.ok(saveBlock.includes('setCategories(nextCategories)'));
    assert.equal(saveBlock.includes('setGroups'), false);
    assert.equal(saveBlock.includes('toggleAccessGroup'), false);
    assert.equal(saveBlock.includes('toggleDocumentClass'), false);
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

  it('medição de anchors evita loop com snapshot de paths', () => {
    const lines = readSrc('features/rules/components/governance/ConnectionLines.tsx');
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(lines.includes('pathsSnapshotRef'));
    assert.ok(canvas.includes('createAnchorRefFactory'));
    assert.ok(canvas.includes('scheduleAnchorsUpdate'));
  });

  it('erro ao salvar mantém draft e permite nova tentativa', () => {
    const rules = readSrc('features/rules/hooks/useRules.ts');
    assert.ok(rules.includes('throw err'));
    assert.ok(rules.includes('Não foi possível salvar as alterações'));
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('catch'));
    assert.ok(canvas.includes('Descartar alterações'));
  });
});
