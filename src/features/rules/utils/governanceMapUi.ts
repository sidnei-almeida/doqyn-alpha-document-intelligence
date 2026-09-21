import type { DocumentAccessPermissions } from '../api/rulesApi';

/** Chaves do namespace `rules`; a tela traduz. */
const PERMISSION_SHORT_KEYS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'permission.short.view',
  download: 'permission.short.download',
  upload: 'permission.short.upload',
  share: 'permission.short.share',
  manage: 'permission.short.manage',
};

export const PERMISSION_HINT_KEYS: Record<keyof DocumentAccessPermissions, string> = {
  view: 'permission.hint.view',
  download: 'permission.hint.download',
  // O rótulo diz o que a permissão realmente concede desde D-24: o mesmo flag que libera enviar
  // nova versão agora também libera editar metadados e arquivar. Deixá-lo como "Enviar" faria o
  // mapa de regras prometer menos poder do que o backend concede.
  upload: 'permission.hint.upload',
  share: 'permission.hint.share',
  manage: 'permission.hint.manage',
};

export function getActivePermissionShortKeys(permissions: DocumentAccessPermissions): string[] {
  return (Object.keys(PERMISSION_SHORT_KEYS) as Array<keyof DocumentAccessPermissions>)
    .filter((key) => permissions[key])
    .map((key) => PERMISSION_SHORT_KEYS[key]);
}
