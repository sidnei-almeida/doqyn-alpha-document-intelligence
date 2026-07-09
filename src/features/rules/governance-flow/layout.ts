import type { FlowPosition, FlowPositionMap } from './types';
import { categoryNodeId, groupNodeId } from './types';

/**
 * Largura fixa dos cards no canvas (padrão de ferramentas de fluxo tipo n8n/Miro).
 * 380px comporta os badges de permissão em texto ("Ver", "Baixar", …) sem truncar.
 */
export const FLOW_NODE_WIDTH = 380;

const CATEGORY_COLUMN_X = 0;
const COLUMN_GAP = 320;
const GROUP_COLUMN_X = FLOW_NODE_WIDTH + COLUMN_GAP;
const COLUMN_TOP = 0;
/* Alturas de linha estimadas: os cards têm altura variável (listas de conexões),
   então o espaçamento vertical é generoso para evitar sobreposição inicial. */
const CATEGORY_ROW_GAP = 220;
const GROUP_ROW_GAP = 240;

/**
 * Reproduz o layout clássico em duas colunas na primeira renderização:
 * categorias à esquerda, grupos documentais à direita, espaçados verticalmente.
 */
export function buildInitialGovernancePositions(
  categoryIds: string[],
  groupIds: string[],
): FlowPositionMap {
  const positions: FlowPositionMap = {};

  categoryIds.forEach((categoryId, index) => {
    positions[categoryNodeId(categoryId)] = {
      x: CATEGORY_COLUMN_X,
      y: COLUMN_TOP + index * CATEGORY_ROW_GAP,
    };
  });

  groupIds.forEach((groupId, index) => {
    positions[groupNodeId(groupId)] = {
      x: GROUP_COLUMN_X,
      y: COLUMN_TOP + index * GROUP_ROW_GAP,
    };
  });

  return positions;
}

/* Layout "espalhado" do Organizar automaticamente: usa sub-colunas e gaps
   maiores para aproveitar viewports largas em vez de empilhar tudo no centro. */
const SPREAD_COLUMN_WIDTH = FLOW_NODE_WIDTH + 120;
const SPREAD_ROW_GAP = 320;
const SPREAD_REGION_GAP = 460;

function spreadColumnCount(itemCount: number): number {
  return itemCount >= 4 ? 2 : 1;
}

function spreadExtent(itemCount: number, columns: number): number {
  if (itemCount <= 1) return 0;
  if (columns === 1) return (itemCount - 1) * SPREAD_ROW_GAP;
  // Duas sub-colunas: a segunda é deslocada meia linha e pode ter uma linha a menos.
  const firstColumnRows = Math.ceil(itemCount / 2);
  const secondColumnRows = Math.floor(itemCount / 2);
  const firstColumnMax = (firstColumnRows - 1) * SPREAD_ROW_GAP;
  const secondColumnMax =
    secondColumnRows > 0 ? (secondColumnRows - 1) * SPREAD_ROW_GAP + SPREAD_ROW_GAP / 2 : 0;
  return Math.max(firstColumnMax, secondColumnMax);
}

/**
 * Layout do botão "Organizar automaticamente": distribui categorias e grupos
 * em sub-colunas com deslocamento de meia linha (estilo n8n), regiões afastadas
 * e colunas centralizadas verticalmente entre si — mais largo e menos alto que
 * o layout inicial, preenchendo melhor o canvas.
 */
export function buildSpreadGovernancePositions(
  categoryIds: string[],
  groupIds: string[],
): FlowPositionMap {
  const positions: FlowPositionMap = {};

  const categoryColumns = spreadColumnCount(categoryIds.length);
  const groupColumns = spreadColumnCount(groupIds.length);

  const categoryExtent = spreadExtent(categoryIds.length, categoryColumns);
  const groupExtent = spreadExtent(groupIds.length, groupColumns);
  const maxExtent = Math.max(categoryExtent, groupExtent);

  const categoryOffsetY = (maxExtent - categoryExtent) / 2;
  const groupOffsetY = (maxExtent - groupExtent) / 2;

  const placeColumn = (
    ids: string[],
    columns: number,
    regionX: number,
    offsetY: number,
    toNodeId: (id: string) => string,
  ) => {
    ids.forEach((id, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const stagger = columns === 2 && column === 1 ? SPREAD_ROW_GAP / 2 : 0;
      positions[toNodeId(id)] = {
        x: regionX + column * SPREAD_COLUMN_WIDTH,
        y: offsetY + row * SPREAD_ROW_GAP + stagger,
      };
    });
  };

  placeColumn(categoryIds, categoryColumns, 0, categoryOffsetY, categoryNodeId);

  const categoryRegionWidth = (categoryColumns - 1) * SPREAD_COLUMN_WIDTH + FLOW_NODE_WIDTH;
  const groupRegionX = categoryRegionWidth + SPREAD_REGION_GAP;
  placeColumn(groupIds, groupColumns, groupRegionX, groupOffsetY, groupNodeId);

  return positions;
}

export function flowPositionsEqual(
  a: FlowPosition | undefined,
  b: FlowPosition | undefined,
): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/**
 * Conta quantos nodes têm posição diferente do último estado salvo.
 * Nodes sem entrada no estado salvo (recém-criados) não contam como movidos.
 */
export function countMovedNodes(saved: FlowPositionMap, current: FlowPositionMap): number {
  let moved = 0;
  for (const [nodeId, position] of Object.entries(current)) {
    const savedPosition = saved[nodeId];
    if (savedPosition && !flowPositionsEqual(savedPosition, position)) moved += 1;
  }
  return moved;
}

export function flowPositionMapsEqual(a: FlowPositionMap, b: FlowPositionMap): boolean {
  return countMovedNodes(a, b) === 0;
}
