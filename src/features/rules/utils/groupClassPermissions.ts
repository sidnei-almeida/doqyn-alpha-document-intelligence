import type { GovernancePermissionValue } from '@shared/governancePermissions';
import type { DocumentCategory } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';

/** Chaves do namespace `rules`; a tela traduz. */
export const PERMISSION_LABEL_KEYS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'permission.label.view',
  download: 'permission.label.download',
  /** Ver `PERMISSION_HINT_KEYS.upload`: desde D-24 este flag concede enviar + editar + arquivar. */
  upload: 'permission.label.upload',
  share: 'permission.label.share',
  manage: 'permission.label.manage',
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
