import type { GovernancePermissionValue } from '@shared/governancePermissions';
import type { DocumentCategory } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';

export const PERMISSION_LABELS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'Visualizar',
  download: 'Baixar',
  /** Ver `PERMISSION_HINTS.upload`: desde D-24 este flag concede enviar + editar + arquivar. */
  upload: 'Alterar',
  share: 'Compartilhar',
  manage: 'Gerenciar',
};

/**
 * Estado do grupo naquele verbo, e não só "está na lista".
 *
 * As listas dizem **quem alcança** a categoria, e quem precisa pedir alcança — ler só elas
 * devolveria `true` para uma célula em `require`. E `true` é o que o diálogo grava de volta ao
 * salvar: o meio-termo configurado pelo administrador viraria "liberado" sem ninguém tocar nele,
 * que é justamente o lado errado para degradar.
 */
function readState(
  inList: boolean,
  states: Record<string, 'require'> | undefined,
  groupId: string,
): GovernancePermissionValue {
  if (!inList) return false;
  return states?.[groupId] === 'require' ? 'require' : true;
}

export function readGroupClassPermissions(
  category: DocumentCategory,
  groupId: string,
): DocumentAccessPermissions {
  const perms = category.permissions ?? {
    view: category.documentGroupIds,
    download: [],
    update: [],
    audit: [],
    share: [],
  };
  const states = category.permissionStates;

  return {
    view: readState(perms.view.includes(groupId), states?.view, groupId),
    download: readState(perms.download.includes(groupId), states?.download, groupId),
    upload: readState(perms.update.includes(groupId), states?.update, groupId),
    share: readState(perms.share.includes(groupId), states?.share, groupId),
    manage: readState(perms.audit.includes(groupId), states?.audit, groupId),
  };
}
