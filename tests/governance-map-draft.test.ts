import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  cloneGovernanceEdges,
  countGovernanceEdgeChanges,
  createGovernanceEdge,
  diffGovernanceEdges,
  governanceEdgesEqual,
} from '../src/features/rules/utils/governanceMapDraft.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('governance map draft — utilitários', () => {
  const original = [
    createGovernanceEdge('cat-1', 'grp-a'),
    createGovernanceEdge('cat-1', 'grp-b'),
  ];

  it('diffGovernanceEdges calcula added e removed', () => {
    const draft = [createGovernanceEdge('cat-1', 'grp-a'), createGovernanceEdge('cat-2', 'grp-c')];

    const diff = diffGovernanceEdges(original, draft);

    assert.equal(diff.added.length, 1);
    assert.equal(diff.added[0]?.id, 'cat-2:grp-c');
    assert.equal(diff.removed.length, 1);
    assert.equal(diff.removed[0]?.id, 'cat-1:grp-b');
  });

  it('countGovernanceEdgeChanges soma adições e remoções', () => {
    const draft = [createGovernanceEdge('cat-1', 'grp-a'), createGovernanceEdge('cat-2', 'grp-c')];
    assert.equal(countGovernanceEdgeChanges(original, draft), 2);
  });

  it('governanceEdgesEqual ignora ordem', () => {
    const a = [createGovernanceEdge('cat-1', 'grp-a'), createGovernanceEdge('cat-1', 'grp-b')];
    const b = [createGovernanceEdge('cat-1', 'grp-b'), createGovernanceEdge('cat-1', 'grp-a')];
    assert.equal(governanceEdgesEqual(a, b), true);
  });

  it('cloneGovernanceEdges copia permissões', () => {
    const edge = createGovernanceEdge('cat-1', 'grp-a');
    const cloned = cloneGovernanceEdges([edge]);
    cloned[0]!.permissions.view = false;
    assert.equal(edge.permissions.view, true);
  });
});

describe('governance map draft — canvas e hook', () => {
  it('GovernanceMapCanvas usa draft local sem chamar backend na desconexão', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('useGovernanceMapDraft'));
    assert.ok(canvas.includes('performDraftDisconnect'));
    assert.ok(canvas.includes('removeEdge'));
    assert.equal(canvas.includes('onDisconnect={disconnectGroupFromCategory}'), false);
    assert.equal(canvas.includes('onDisconnect:'), false);
    assert.equal(canvas.includes('await onDisconnect'), false);
  });

  it('clique no × e Delete alteram apenas draftEdges', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('handleEdgeDisconnect'));
    assert.ok(canvas.includes('performDraftDisconnect'));
    assert.ok(canvas.includes("event.key !== 'Delete'"));
    assert.ok(canvas.includes("event.key !== 'Backspace'"));
    assert.equal(canvas.includes('await onPermissionChange'), false);
  });

  it('conectar via drag ou modo conexão usa addEdge no draft', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('addEdge(categoryId, groupId)'));
    assert.ok(canvas.includes('handleConnect'));
    assert.equal(canvas.includes('toast.success(\'Conexão criada.\')'), false);
  });

  it('mostra alterações pendentes e controles Desfazer/Descartar/Salvar', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('alteração pendente'));
    assert.ok(canvas.includes('Desfazer'));
    assert.ok(canvas.includes('Descartar alterações'));
    assert.ok(canvas.includes('Salvar alterações'));
    assert.ok(canvas.includes('pendingCount'));
    assert.ok(canvas.includes('dirty'));
  });

  it('Salvar chama onSaveMapChanges com diff e commitSaved', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('onSaveMapChanges(getDiff())'));
    assert.ok(canvas.includes('commitSaved(savedEdges)'));
  });

  it('useGovernanceMapDraft expõe undoStack e discard', () => {
    const hook = readSrc('features/rules/hooks/useGovernanceMapDraft.ts');
    assert.ok(hook.includes('undoStack'));
    assert.ok(hook.includes('discard'));
    assert.ok(hook.includes('useUnsavedMapChangesGuard'));
    assert.ok(hook.includes('useBlocker'));
  });

  it('saveGovernanceMapChanges persiste diff com connect e disconnect', () => {
    const rules = readSrc('features/rules/hooks/useRules.ts');
    assert.ok(rules.includes('saveGovernanceMapChanges'));
    assert.ok(rules.includes('connectGroupToCategory'));
    assert.ok(rules.includes('for (const edge of diff.removed)'));
    assert.ok(rules.includes('for (const edge of diff.added)'));
  });

  it('RulesPage repassa onSaveMapChanges ao canvas', () => {
    const page = readSrc('features/rules/RulesPage.tsx');
    assert.ok(page.includes('saveGovernanceMapChanges'));
    assert.ok(page.includes('onSaveMapChanges={saveGovernanceMapChanges}'));
    assert.equal(page.includes('onDisconnect={disconnectGroupFromCategory}'), false);
  });

  it('categoria usa contagem do draft, não accessGroupIds do backend', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('connectedGroupCount'));
    assert.ok(canvas.includes('categoryToGroups.get(category.id)?.size'));
    assert.equal(canvas.includes('category.accessGroupIds.length'), false);
  });

  it('addEdge evita edge duplicada', () => {
    const hook = readSrc('features/rules/hooks/useGovernanceMapDraft.ts');
    assert.ok(hook.includes('if (current.some((edge) => edge.id === edgeId)) return current'));
  });

  it('proteção ao sair com alterações pendentes', () => {
    const hook = readSrc('features/rules/hooks/useGovernanceMapDraft.ts');
    assert.ok(hook.includes('beforeunload'));
    assert.ok(hook.includes('alterações não salvas'));
  });
});
