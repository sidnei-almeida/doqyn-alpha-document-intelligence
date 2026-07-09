import type { FlowPosition, FlowPositionMap } from './types';

/*
 * TODO(api): não existe endpoint para persistir o layout do mapa de governança.
 * Quando houver (ex.: PUT /document-rules/map-layout), substituir este módulo por
 * uma mutation TanStack Query e usar o localStorage apenas como cache offline.
 * As chaves abaixo também deveriam ser escopadas por tenant quando a API existir.
 */
const SAVED_LAYOUT_KEY = 'doqyn-permissions-flow';
const DRAFT_LAYOUT_KEY = 'doqyn-permissions-flow:draft';

function isFlowPosition(value: unknown): value is FlowPosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FlowPosition).x === 'number' &&
    typeof (value as FlowPosition).y === 'number' &&
    Number.isFinite((value as FlowPosition).x) &&
    Number.isFinite((value as FlowPosition).y)
  );
}

function parsePositionMap(raw: string | null): FlowPositionMap | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

    const positions: FlowPositionMap = {};
    for (const [nodeId, position] of Object.entries(parsed)) {
      if (isFlowPosition(position)) positions[nodeId] = { x: position.x, y: position.y };
    }
    return positions;
  } catch {
    return null;
  }
}

function readKey(key: string): FlowPositionMap | null {
  try {
    return parsePositionMap(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeKey(key: string, positions: FlowPositionMap): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(positions));
  } catch {
    // localStorage indisponível (modo privado/quota) — layout segue apenas em memória.
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // sem efeito colateral se o storage não estiver disponível
  }
}

/** Layout definitivo — atualizado apenas em "Salvar alterações". */
export function loadSavedFlowLayout(): FlowPositionMap | null {
  return readKey(SAVED_LAYOUT_KEY);
}

export function persistSavedFlowLayout(positions: FlowPositionMap): void {
  writeKey(SAVED_LAYOUT_KEY, positions);
}

/** Rascunho automático — nunca vira definitivo sem passar pelo Salvar. */
export function loadDraftFlowLayout(): FlowPositionMap | null {
  return readKey(DRAFT_LAYOUT_KEY);
}

export function persistDraftFlowLayout(positions: FlowPositionMap): void {
  writeKey(DRAFT_LAYOUT_KEY, positions);
}

export function clearDraftFlowLayout(): void {
  removeKey(DRAFT_LAYOUT_KEY);
}
