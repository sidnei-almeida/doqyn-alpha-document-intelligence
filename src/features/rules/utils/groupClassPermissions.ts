import type { DocumentCategory } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';

export const PERMISSION_LABELS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'Visualizar',
  download: 'Baixar',
  upload: 'Enviar',
  share: 'Compartilhar',
  manage: 'Gerenciar',
};

export function readGroupClassPermissions(
  category: DocumentCategory,
  groupId: string,
): DocumentAccessPermissions {
  const perms = category.permissions ?? {
    view: category.accessGroupIds,
    download: [],
    update: [],
    audit: [],
    share: [],
  };

  return {
    view: perms.view.includes(groupId),
    download: perms.download.includes(groupId),
    upload: perms.update.includes(groupId),
    share: perms.share.includes(groupId),
    manage: perms.audit.includes(groupId),
  };
}
