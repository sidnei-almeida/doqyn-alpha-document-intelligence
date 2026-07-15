import type { DocumentAccessPermissions } from '../api/rulesApi';

/** Permissões iniciais ao conectar um grupo a uma categoria. */
export const DEFAULT_CONNECTION_PERMISSIONS: DocumentAccessPermissions = {
  view: true,
  download: false,
  upload: false,
  share: false,
  manage: false,
};

/** Ausência total de permissões — desativa a regra grupo ↔ categoria no backend. */
export const EMPTY_CONNECTION_PERMISSIONS: DocumentAccessPermissions = {
  view: false,
  download: false,
  upload: false,
  share: false,
  manage: false,
};
