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
  accessGroupIds: string[],
  overrides: Partial<DocumentCategory> = {},
): DocumentCategory {
  return {
    id,
    name: `Categoria ${id}`,
    description: 'Descrição',
    icon: 'file',
    accessGroupIds,
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
  it('listGovernanceEdges deriva conexões reais de category.accessGroupIds', () => {
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

  it('GovernanceMapCanvas renderiza categorias e grupos como nodes do mapa', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('MapCategoryCard'));
    assert.ok(source.includes('MapGroupCard'));
    assert.ok(source.includes('useGovernanceMapDraft'));
    assert.ok(source.includes('Nenhuma categoria criada ainda.'));
    assert.ok(source.includes('Nenhum grupo documental criado ainda.'));
  });

  it('ConnectionLines desenha bezier SVG com anchors e edges', () => {
    const source = readSrc('features/rules/components/governance/ConnectionLines.tsx');
    assert.ok(source.includes('buildCurve'));
    assert.ok(source.includes('absolute inset-0'));
    assert.ok(source.includes('ResizeObserver'));
    assert.ok(source.includes('governance-edge-arrow'));
    assert.ok(source.includes('edges'));
    assert.equal(source.includes('membro'), false);
    assert.ok(source.includes('×'));
    assert.ok(source.includes('hovered || selected'));
  });

  it('canvas não usa fundo azulado ou gradiente indigo', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.equal(source.includes('radial-gradient'), false);
    assert.equal(source.includes('99,102,241'), false);
    assert.equal(source.includes('#0a0e14'), false);
    assert.ok(source.includes('bg-doqyn-bg'));
  });

  it('não duplica grupos como chips acima dos cards', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.equal(source.includes('<DraggableGroupChip'), false);
  });

  it('ConnectionLines só atualiza paths quando posições mudam', () => {
    const source = readSrc('features/rules/components/governance/ConnectionLines.tsx');
    assert.ok(source.includes('pathsSnapshotRef'));
    assert.ok(source.includes('serializePaths'));
  });

  it('hover/selected não usa setState em callback ref instável', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    const registry = readSrc('features/rules/utils/governanceAnchorRegistry.ts');
    assert.ok(canvas.includes('createAnchorRefFactory'));
    assert.ok(canvas.includes('scheduleAnchorsUpdate'));
    assert.ok(canvas.includes('setHoveredNode'));
    assert.ok(registry.includes('resolveAnchorUpdate'));
  });

  it('/rules continua sem editar membros diretamente', () => {
    const canvas = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.equal(canvas.includes('Adicionar membro'), false);
    assert.ok(canvas.includes('Membros gerenciados em'));
    assert.ok(canvas.includes('/users'));
  });

  it('mostra dica central quando há categoria e grupo sem conexão', () => {
    const source = readSrc('features/rules/components/governance/GovernanceMapCanvas.tsx');
    assert.ok(source.includes('Conecte categorias aos grupos documentais para definir o acesso'));
    assert.ok(source.includes('showConnectionHint'));
  });
});
