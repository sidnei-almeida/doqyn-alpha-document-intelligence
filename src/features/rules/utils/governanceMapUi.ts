import { getFolderAccentColor } from '@/features/library/utils/folderColors';
import type { DocumentAccessPermissions } from '../api/rulesApi';
import type { GovernanceEdge } from './governanceConnections';
import { PERMISSION_LABELS } from './groupClassPermissions';

const PERMISSION_SHORT: Record<keyof DocumentAccessPermissions, string> = {
  view: 'Ver',
  download: 'Baixar',
  upload: 'Enviar',
  share: 'Compartilhar',
  manage: 'Gerir',
};

export const PERMISSION_HINTS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'Abre documentos desta categoria no visualizador.',
  download: 'Permite baixar o arquivo original.',
  upload: 'Pode enviar novas versões nesta categoria.',
  share: 'Pode compartilhar documentos com terceiros.',
  manage: 'Acesso administrativo: metadados, auditoria e configurações.',
};

export function getActivePermissionLabels(permissions: DocumentAccessPermissions): string[] {
  return (Object.keys(PERMISSION_LABELS) as Array<keyof DocumentAccessPermissions>)
    .filter((key) => permissions[key])
    .map((key) => PERMISSION_LABELS[key]);
}

export function getActivePermissionShortLabels(permissions: DocumentAccessPermissions): string[] {
  return (Object.keys(PERMISSION_SHORT) as Array<keyof DocumentAccessPermissions>)
    .filter((key) => permissions[key])
    .map((key) => PERMISSION_SHORT[key]);
}

export function getCategoryAccentColor(name: string): string | undefined {
  return getFolderAccentColor(name);
}

/** Cor da categoria para linhas do mapa — fallback neutro quando não há slug conhecido. */
export function getCategoryEdgeColor(name: string): string {
  return getCategoryAccentColor(name) ?? 'var(--folder-accent-default)';
}

export function buildCategoryColorMap(
  categories: Array<{ id: string; name: string }>,
): Record<string, string> {
  return Object.fromEntries(
    categories.map((category) => [category.id, getCategoryEdgeColor(category.name)]),
  );
}

export function summarizeMapStats(
  categoryCount: number,
  groupCount: number,
  edges: GovernanceEdge[],
): { categoryCount: number; groupCount: number; connectionCount: number } {
  return {
    categoryCount,
    groupCount,
    connectionCount: edges.length,
  };
}
