import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  listGovernanceEdges,
  listGovernanceConnections,
} from '../src/features/rules/utils/governanceConnections.js';
import type { DocumentCategory, Group } from '../src/types/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

function makeCategory(
  id: string,
  documentGroupIds: string[],
  overrides: Partial<DocumentCategory> = {},
): DocumentCategory {
  return {
    id,
    name: `Categoria ${id}`,
    description: 'Descrição',
    icon: 'file',
    documentGroupIds,
    groupClassPermissions: {},
    extractionConfig: null,
    ...overrides,
  } as DocumentCategory;
}

function makeGroup(id: string, overrides: Partial<Group> = {}): Group {
  return {
    id,
    name: `Grupo ${id}`,
    color: 'blue',
    memberCount: 0,
    ...overrides,
  } as Group;
}

describe('Governance Map Canvas — edges e empty states', () => {
  it('listGovernanceEdges deriva conexões reais de category.documentGroupIds', () => {
    const categories = [makeCategory('cat-1', ['grp-a', 'grp-b'])];
    const groups = [makeGroup('grp-a'), makeGroup('grp-b'), makeGroup('grp-c')];

    const edges = listGovernanceEdges(categories, groups);

    assert.equal(edges.length, 2);
    assert.deepEqual(
      edges.map((edge) => edge.id).sort(),
      ['cat-1:grp-a', 'cat-1:grp-b'],
    );
    assert.equal(edges[0]?.sourceType, 'category');
    assert.equal(edges[0]?.targetType, 'documentGroup');
    assert.equal(edges[0]?.sourceId, 'cat-1');
    assert.equal(edges[0]?.targetId, 'grp-a');
  });

  it('não cria edge quando grupo não existe ou não há permissão vinculada', () => {
    const categories = [makeCategory('cat-1', ['grp-missing'])];
    const groups = [makeGroup('grp-a')];

    assert.equal(listGovernanceEdges(categories, groups).length, 0);
    assert.equal(listGovernanceConnections(categories, groups).length, 0);
  });

  it('não cria edge duplicada para o mesmo par categoria-grupo', () => {
    const categories = [makeCategory('cat-1', ['grp-a', 'grp-a', 'grp-a'])];
    const groups = [makeGroup('grp-a')];

    assert.equal(listGovernanceEdges(categories, groups).length, 1);
  });

  it('GovernanceMapCanvas renderiza categorias e grupos como nodes do React Flow', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('GovernanceFlowCanvas'));
    assert.ok(source.includes('categoryCard'));
    assert.ok(source.includes('groupCard'));
    assert.ok(source.includes('useGovernanceFlowDraft'));
    assert.ok(source.includes('Nenhuma categoria criada ainda.'));
    assert.ok(source.includes('Nenhum grupo documental criado ainda.'));
  });

  it('PermissionEdge desenha bezier recalculado a cada render com cor por categoria', () => {
    const edge = readSrc('features/rules/governance-flow/PermissionEdge.tsx');
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(edge.includes('getBezierPath'));
    assert.ok(edge.includes('BaseEdge'));
    assert.ok(edge.includes('EdgeLabelRenderer'));
    assert.ok(edge.includes('×'));
    assert.ok(edge.includes('Desconectar categoria'));
    assert.ok(canvas.includes('categoryColors[edge.sourceId]'));
    assert.ok(canvas.includes('buildCategoryColorMap'));
    assert.ok(canvas.includes('stroke'));
  });

  it('canvas não usa fundo azulado ou gradiente indigo', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    assert.equal(source.includes('radial-gradient'), false);
    assert.equal(source.includes('99,102,241'), false);
    assert.equal(source.includes('#0a0e14'), false);
    assert.ok(source.includes('rules-map-canvas'));
    assert.ok(globals.includes('.rules-map-canvas'));
  });

  it('não duplica grupos como chips acima dos cards', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.equal(source.includes('<DraggableGroupChip'), false);
  });

  it('cards são arrastáveis livremente com posição viva {x,y}', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const flow = readSrc('features/rules/governance-flow/GovernanceFlowCanvas.tsx');
    const hook = readSrc('features/rules/governance-flow/useGovernanceFlowDraft.ts');
    assert.ok(canvas.includes('moveNode'));
    assert.ok(canvas.includes('beginNodeDrag'));
    assert.ok(canvas.includes('endNodeDrag'));
    assert.ok(flow.includes('onNodeDragStart'));
    assert.ok(flow.includes('onNodeDragStop'));
    assert.ok(flow.includes("change.type === 'position'"));
    assert.ok(hook.includes('positions'));
  });

  it('conexão via handle valida categoria→grupo sem duplicada', () => {
    const flow = readSrc('features/rules/governance-flow/GovernanceFlowCanvas.tsx');
    const validation = readSrc('features/rules/governance-flow/validation.ts');
    assert.ok(flow.includes('isValidConnection'));
    assert.ok(flow.includes('onConnect'));
    assert.ok(validation.includes('parseCategoryNodeId'));
    assert.ok(validation.includes('parseGroupNodeId'));
    assert.ok(validation.includes('sourceNodeId === targetNodeId'));
    assert.ok(validation.includes('!draftEdges.some'));
  });

  it('/rules continua sem editar membros diretamente', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const groupNode = readSrc('features/rules/governance-flow/GroupCardNode.tsx');
    assert.equal(canvas.includes('Adicionar membro'), false);
    assert.ok(groupNode.includes('Membros em'));
    assert.ok(groupNode.includes('/users'));
  });

  it('mostra dica central quando há categoria e grupo sem conexão', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('Comece conectando acesso'));
    assert.ok(source.includes('showConnectionHint'));
    assert.ok(source.includes('GovernanceMapSummary'));
  });

  it('conexão abre dialog de permissões via chips ou duplo clique na aresta', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const flow = readSrc('features/rules/governance-flow/GovernanceFlowCanvas.tsx');
    const dialog = readSrc('features/rules/components/governance/GovernanceDetailDialog.tsx');
    assert.ok(canvas.includes("type: 'connection'"));
    assert.ok(canvas.includes('onSelectConnection'));
    assert.ok(canvas.includes('openConnectionDetail'));
    assert.ok(flow.includes('onEdgeDoubleClick'));
    assert.ok(dialog.includes("selection.type === 'connection'"));
    assert.ok(dialog.includes('PERMISSION_HINTS'));
  });

  it('canvas usa Background dots e Controls; MiniMap e attribution controlados por env', () => {
    const flow = readSrc('features/rules/governance-flow/GovernanceFlowCanvas.tsx');
    const config = readSrc('features/rules/governance-flow/reactFlowUiConfig.ts');
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    const envExample = readFileSync(join(__dirname, '..', '.env.example'), 'utf8');

    assert.ok(flow.includes('BackgroundVariant.Dots'));
    assert.ok(flow.includes('<Controls'));
    assert.ok(flow.includes("import '@xyflow/react/dist/style.css'"));
    assert.ok(globals.includes('.governance-flow'));
    assert.ok(globals.includes('react-flow__controls-button'));

    // MiniMap condicional — não renderiza por padrão (flag false).
    assert.ok(flow.includes('REACT_FLOW_SHOW_MINIMAP'));
    assert.ok(flow.includes('REACT_FLOW_SHOW_MINIMAP ?'));
    assert.ok(flow.includes('<MiniMap'));
    assert.ok(config.includes("envFlag('VITE_REACT_FLOW_SHOW_MINIMAP', false)"));

    // Attribution via API oficial do React Flow.
    assert.ok(flow.includes('proOptions={{ hideAttribution: REACT_FLOW_HIDE_ATTRIBUTION }}'));
    assert.ok(config.includes("envFlag('VITE_REACT_FLOW_HIDE_ATTRIBUTION', true)"));

    assert.ok(envExample.includes('VITE_REACT_FLOW_HIDE_ATTRIBUTION=true'));
    assert.ok(envExample.includes('VITE_REACT_FLOW_SHOW_MINIMAP=false'));
  });

  it('mapa oferece modo tela cheia com saída por botão ou Escape', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');

    assert.ok(canvas.includes('isMapFullscreen'));
    assert.ok(canvas.includes('rules-map-canvas--fullscreen'));
    assert.ok(canvas.includes('fullscreen'));
    assert.ok(canvas.includes('fullscreen_exit'));
    assert.ok(canvas.includes("event.key === 'Escape'"));
    assert.ok(globals.includes('.rules-map-canvas--fullscreen'));
  });

  it('toolbar de pendências aparece só com isDirty e tem Desfazer/Refazer/Descartar/Salvar', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(canvas.includes('isAdmin && dirty && ('));
    assert.ok(canvas.includes('Desfazer'));
    assert.ok(canvas.includes('Refazer'));
    assert.ok(canvas.includes('Descartar alterações'));
    assert.ok(canvas.includes('Salvar alterações'));
    assert.ok(canvas.includes('Organizar automaticamente'));
  });

  it('salvar exige a frase exata CONFIRMAR ALTERAÇÕES com resumo das mudanças', () => {
    const modal = readSrc('features/rules/governance-flow/SaveConfirmModal.tsx');
    assert.ok(modal.includes("'CONFIRMAR ALTERAÇÕES'"));
    assert.ok(modal.includes('typedText.trim() === SAVE_CONFIRMATION_PHRASE'));
    assert.ok(modal.includes('conexão adicionada'));
    assert.ok(modal.includes('conexão removida'));
    assert.ok(modal.includes('card movido'));
    assert.ok(modal.includes('disabled={!textMatches || saving}'));
  });

  it('layout persiste em localStorage com TODO para plugar API', () => {
    const storage = readSrc('features/rules/governance-flow/layoutStorage.ts');
    assert.ok(storage.includes("'doqyn-permissions-flow'"));
    assert.ok(storage.includes('TODO(api)'));
    assert.ok(storage.includes('persistSavedFlowLayout'));
    assert.ok(storage.includes('persistDraftFlowLayout'));
  });

  it('posições iniciais reproduzem o layout em duas colunas', () => {
    const layout = readSrc('features/rules/governance-flow/layout.ts');
    assert.ok(layout.includes('buildInitialGovernancePositions'));
    assert.ok(layout.includes('CATEGORY_COLUMN_X'));
    assert.ok(layout.includes('GROUP_COLUMN_X'));
    assert.ok(layout.includes('FLOW_NODE_WIDTH'));
  });
});
