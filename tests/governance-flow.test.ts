import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInitialGovernancePositions,
  buildSpreadGovernancePositions,
  countMovedNodes,
  flowPositionMapsEqual,
  FLOW_NODE_WIDTH,
} from '../src/features/rules/governance-flow/layout.js';
import { isValidGovernanceConnection } from '../src/features/rules/governance-flow/validation.js';
import {
  REACT_FLOW_HIDE_ATTRIBUTION,
  REACT_FLOW_SHOW_MINIMAP,
} from '../src/features/rules/governance-flow/reactFlowUiConfig.js';
import {
  createInitialDraftState,
  governanceDraftReducer,
  selectDirty,
  selectPendingCounts,
  MAX_HISTORY_SNAPSHOTS,
  type GovernanceDraftState,
} from '../src/features/rules/governance-flow/draftReducer.js';
import { createGovernanceEdge } from '../src/features/rules/utils/governanceMapDraft.js';

describe('governance-flow — configuração de UI do React Flow', () => {
  it('defaults sem env explícita: attribution oculta, MiniMap desligado', () => {
    assert.equal(REACT_FLOW_HIDE_ATTRIBUTION, true);
    assert.equal(REACT_FLOW_SHOW_MINIMAP, false);
  });
});

describe('governance-flow — layout inicial em duas colunas', () => {
  it('categorias na coluna esquerda e grupos na direita, espaçados verticalmente', () => {
    const positions = buildInitialGovernancePositions(['cat-1', 'cat-2'], ['grp-a', 'grp-b']);

    assert.equal(positions['category-cat-1']!.x, positions['category-cat-2']!.x);
    assert.equal(positions['group-grp-a']!.x, positions['group-grp-b']!.x);
    assert.ok(positions['group-grp-a']!.x > positions['category-cat-1']!.x + FLOW_NODE_WIDTH);
    assert.ok(positions['category-cat-2']!.y > positions['category-cat-1']!.y);
    assert.ok(positions['group-grp-b']!.y > positions['group-grp-a']!.y);
  });

  it('layout espalhado usa sub-colunas e ocupa mais largura que o inicial', () => {
    const categoryIds = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    const groupIds = ['g1', 'g2', 'g3', 'g4', 'g5'];
    const spread = buildSpreadGovernancePositions(categoryIds, groupIds);
    const initial = buildInitialGovernancePositions(categoryIds, groupIds);

    // Com 4+ itens, cada lado abre uma segunda sub-coluna (x distintos).
    const categoryXs = new Set(categoryIds.map((id) => spread[`category-${id}`]!.x));
    const groupXs = new Set(groupIds.map((id) => spread[`group-${id}`]!.x));
    assert.equal(categoryXs.size, 2);
    assert.equal(groupXs.size, 2);

    // Grupos ficam à direita da região de categorias, sem sobreposição.
    const maxCategoryX = Math.max(...categoryXs);
    const minGroupX = Math.min(...groupXs);
    assert.ok(minGroupX >= maxCategoryX + FLOW_NODE_WIDTH);

    // Layout espalhado é mais largo e mais baixo que o inicial (usa melhor a viewport).
    const width = (map: Record<string, { x: number; y: number }>) => {
      const xs = Object.values(map).map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    const height = (map: Record<string, { x: number; y: number }>) => {
      const ys = Object.values(map).map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    assert.ok(width(spread) > width(initial));
    assert.ok(height(spread) < height(initial));

    // Colunas centralizadas verticalmente entre si: extents parecidos.
    const categoryYs = categoryIds.map((id) => spread[`category-${id}`]!.y);
    const groupYs = groupIds.map((id) => spread[`group-${id}`]!.y);
    const categoryCenter = (Math.max(...categoryYs) + Math.min(...categoryYs)) / 2;
    const groupCenter = (Math.max(...groupYs) + Math.min(...groupYs)) / 2;
    assert.ok(Math.abs(categoryCenter - groupCenter) < 1);
  });

  it('layout espalhado mantém coluna única com poucos itens', () => {
    const spread = buildSpreadGovernancePositions(['c1', 'c2'], ['g1']);
    assert.equal(spread['category-c1']!.x, spread['category-c2']!.x);
    assert.ok(spread['group-g1']!.x > spread['category-c1']!.x + FLOW_NODE_WIDTH);
  });

  it('countMovedNodes ignora nodes novos e detecta movimentos reais', () => {
    const saved = { 'category-cat-1': { x: 0, y: 0 } };
    assert.equal(countMovedNodes(saved, { 'category-cat-1': { x: 0, y: 0 } }), 0);
    assert.equal(countMovedNodes(saved, { 'category-cat-1': { x: 10, y: 0 } }), 1);
    assert.equal(
      countMovedNodes(saved, {
        'category-cat-1': { x: 0, y: 0 },
        'group-grp-novo': { x: 700, y: 0 },
      }),
      0,
    );
    assert.ok(flowPositionMapsEqual(saved, { 'category-cat-1': { x: 0.2, y: 0 } }));
  });
});

describe('governance-flow — validação de conexões', () => {
  const draftEdges = [createGovernanceEdge('cat-1', 'grp-a')];

  it('aceita apenas categoria → grupo', () => {
    assert.equal(isValidGovernanceConnection('category-cat-1', 'group-grp-b', draftEdges), true);
    assert.equal(isValidGovernanceConnection('category-cat-1', 'category-cat-2', draftEdges), false);
    assert.equal(isValidGovernanceConnection('group-grp-a', 'group-grp-b', draftEdges), false);
    assert.equal(isValidGovernanceConnection('group-grp-a', 'category-cat-1', draftEdges), false);
  });

  it('bloqueia self-connection e duplicada', () => {
    assert.equal(isValidGovernanceConnection('category-cat-1', 'category-cat-1', draftEdges), false);
    assert.equal(isValidGovernanceConnection('category-cat-1', 'group-grp-a', draftEdges), false);
    assert.equal(isValidGovernanceConnection(null, 'group-grp-a', draftEdges), false);
    assert.equal(isValidGovernanceConnection('category-cat-1', undefined, draftEdges), false);
  });
});

function makeState(): GovernanceDraftState {
  return createInitialDraftState(
    [createGovernanceEdge('cat-1', 'grp-a')],
    { 'category-cat-1': { x: 0, y: 0 }, 'group-grp-a': { x: 700, y: 0 } },
    null,
  );
}

describe('governance-flow — reducer de rascunho com histórico', () => {
  it('addEdge/removeEdge empilham undo e marcam dirty', () => {
    let state = makeState();
    assert.equal(selectDirty(state), false);

    state = governanceDraftReducer(state, { type: 'addEdge', categoryId: 'cat-1', groupId: 'grp-b' });
    assert.equal(state.draft.edges.length, 2);
    assert.equal(state.undoStack.length, 1);
    assert.equal(selectDirty(state), true);
    assert.equal(selectPendingCounts(state).added, 1);

    state = governanceDraftReducer(state, { type: 'removeEdge', edgeId: 'cat-1:grp-a' });
    assert.equal(selectPendingCounts(state).removed, 1);
    assert.equal(selectPendingCounts(state).total, 2);
  });

  it('addEdge duplicada é no-op sem entrada de histórico', () => {
    let state = makeState();
    state = governanceDraftReducer(state, { type: 'addEdge', categoryId: 'cat-1', groupId: 'grp-a' });
    assert.equal(state.draft.edges.length, 1);
    assert.equal(state.undoStack.length, 0);
  });

  it('drag de node gera um único snapshot no fim do drag', () => {
    let state = makeState();
    state = governanceDraftReducer(state, { type: 'nodeDragStart' });
    state = governanceDraftReducer(state, {
      type: 'moveNode',
      nodeId: 'category-cat-1',
      position: { x: 40, y: 12 },
    });
    state = governanceDraftReducer(state, {
      type: 'moveNode',
      nodeId: 'category-cat-1',
      position: { x: 80, y: 24 },
    });
    state = governanceDraftReducer(state, { type: 'nodeDragEnd' });

    assert.equal(state.undoStack.length, 1);
    assert.equal(selectPendingCounts(state).moved, 1);

    state = governanceDraftReducer(state, { type: 'undo' });
    assert.deepEqual(state.draft.positions['category-cat-1'], { x: 0, y: 0 });
    assert.equal(selectDirty(state), false);
  });

  it('undo desfaz passo a passo na ordem inversa e redo restaura', () => {
    let state = makeState();
    state = governanceDraftReducer(state, { type: 'addEdge', categoryId: 'cat-1', groupId: 'grp-b' });
    state = governanceDraftReducer(state, { type: 'removeEdge', edgeId: 'cat-1:grp-a' });
    assert.equal(state.draft.edges.length, 1);

    state = governanceDraftReducer(state, { type: 'undo' });
    assert.deepEqual(state.draft.edges.map((edge) => edge.id).sort(), [
      'cat-1:grp-a',
      'cat-1:grp-b',
    ]);

    state = governanceDraftReducer(state, { type: 'undo' });
    assert.deepEqual(state.draft.edges.map((edge) => edge.id), ['cat-1:grp-a']);
    assert.equal(selectDirty(state), false);

    state = governanceDraftReducer(state, { type: 'redo' });
    assert.equal(state.draft.edges.length, 2);
  });

  it('histórico é limitado a MAX_HISTORY_SNAPSHOTS', () => {
    let state = makeState();
    for (let index = 0; index < MAX_HISTORY_SNAPSHOTS + 10; index += 1) {
      state = governanceDraftReducer(state, {
        type: 'addEdge',
        categoryId: 'cat-1',
        groupId: `grp-${index}`,
      });
    }
    assert.equal(MAX_HISTORY_SNAPSHOTS, 50);
    assert.equal(state.undoStack.length, MAX_HISTORY_SNAPSHOTS);
  });

  it('discard volta ao último salvo e limpa histórico', () => {
    let state = makeState();
    state = governanceDraftReducer(state, { type: 'addEdge', categoryId: 'cat-1', groupId: 'grp-b' });
    state = governanceDraftReducer(state, { type: 'nodeDragStart' });
    state = governanceDraftReducer(state, {
      type: 'moveNode',
      nodeId: 'group-grp-a',
      position: { x: 900, y: 90 },
    });
    state = governanceDraftReducer(state, { type: 'nodeDragEnd' });

    state = governanceDraftReducer(state, { type: 'discard' });
    assert.deepEqual(state.draft.edges.map((edge) => edge.id), ['cat-1:grp-a']);
    assert.deepEqual(state.draft.positions['group-grp-a'], { x: 700, y: 0 });
    assert.equal(state.undoStack.length, 0);
    assert.equal(state.redoStack.length, 0);
    assert.equal(selectDirty(state), false);
  });

  it('commitSaved zera dirty, histórico e adota posições atuais como salvas', () => {
    let state = makeState();
    state = governanceDraftReducer(state, { type: 'addEdge', categoryId: 'cat-1', groupId: 'grp-b' });
    state = governanceDraftReducer(state, { type: 'nodeDragStart' });
    state = governanceDraftReducer(state, {
      type: 'moveNode',
      nodeId: 'group-grp-a',
      position: { x: 900, y: 90 },
    });
    state = governanceDraftReducer(state, { type: 'nodeDragEnd' });

    state = governanceDraftReducer(state, {
      type: 'commitSaved',
      edges: state.draft.edges,
    });

    assert.equal(selectDirty(state), false);
    assert.equal(state.undoStack.length, 0);
    assert.deepEqual(state.original.positions['group-grp-a'], { x: 900, y: 90 });
    assert.equal(state.original.edges.length, 2);
  });

  it('syncServerEdges só atualiza quando não há edição pendente de edges', () => {
    let state = makeState();
    const serverUpdate = [createGovernanceEdge('cat-2', 'grp-a')];

    const synced = governanceDraftReducer(state, { type: 'syncServerEdges', edges: serverUpdate });
    assert.deepEqual(synced.draft.edges.map((edge) => edge.id), ['cat-2:grp-a']);

    state = governanceDraftReducer(state, { type: 'addEdge', categoryId: 'cat-1', groupId: 'grp-b' });
    const blocked = governanceDraftReducer(state, { type: 'syncServerEdges', edges: serverUpdate });
    assert.equal(blocked, state);
  });
});
