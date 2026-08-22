import type { DocumentAccessPermissions } from '../api/rulesApi';

const PERMISSION_SHORT: Record<keyof DocumentAccessPermissions, string> = {
  view: 'Ver',
  download: 'Baixar',
  upload: 'Alterar',
  share: 'Compartilhar',
  manage: 'Gerir',
};

export const PERMISSION_HINTS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'Abre documentos desta categoria no visualizador.',
  download: 'Permite baixar o arquivo original.',
  // O rótulo diz o que a permissão realmente concede desde D-24: o mesmo flag que libera enviar
  // nova versão agora também libera editar metadados e arquivar. Deixá-lo como "Enviar" faria o
  // mapa de regras prometer menos poder do que o backend concede.
  upload: 'Pode enviar novas versões, editar metadados e arquivar documentos desta categoria.',
  share: 'Pode compartilhar documentos com terceiros.',
  manage: 'Acesso administrativo: metadados, auditoria e configurações.',
};

export function getActivePermissionShortLabels(permissions: DocumentAccessPermissions): string[] {
  return (Object.keys(PERMISSION_SHORT) as Array<keyof DocumentAccessPermissions>)
    .filter((key) => permissions[key])
    .map((key) => PERMISSION_SHORT[key]);
}
