import type { DocumentAccessPermissions } from '../api/rulesApi';

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

export function getActivePermissionShortLabels(permissions: DocumentAccessPermissions): string[] {
  return (Object.keys(PERMISSION_SHORT) as Array<keyof DocumentAccessPermissions>)
    .filter((key) => permissions[key])
    .map((key) => PERMISSION_SHORT[key]);
}
