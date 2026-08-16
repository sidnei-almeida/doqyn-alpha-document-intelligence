import type { DocumentAccessOrigin } from '../api/matrixApi';

/**
 * Prioridade entre origens de acesso.
 *
 * Mora fora do componente porque é regra, não pintura: a célula mostra uma origem só, e qual delas
 * aparece muda o que o administrador entende da tela.
 */
/** A origem mais forte manda na célula: dono ganha de tudo, compartilhamento é o mais fraco. */
export const ORIGIN_PRIORITY: DocumentAccessOrigin[] = ['owner', 'admin', 'governance', 'share'];

export function primaryOrigin(origins: DocumentAccessOrigin[]): DocumentAccessOrigin | null {
  for (const origin of ORIGIN_PRIORITY) {
    if (origins.includes(origin)) return origin;
  }
  return null;
}
