import type { DocumentStatus } from '@/types/document';
import { DOCUMENT_STATUSES } from '@/lib/constants';

export type StatusSemantic = 'success' | 'info' | 'warning' | 'danger' | 'pending' | 'neutral';

/**
 * O badge devolve a **chave** do rótulo, não a frase.
 *
 * Este módulo é `.ts` e não pode usar hook; quem renderiza é `StatusPill` e
 * `MemberStatusBadge`, que são componentes e traduzem na hora. Devolver frase daqui
 * significaria português cravado num lugar sem como trocar de idioma.
 */
export type StatusBadgeConfig = {
  labelKey: string;
  semantic: StatusSemantic;
};

const MEMBER_LABEL_KEYS: Record<string, string> = {
  active: 'common:memberStatus.active',
  pending: 'common:memberStatus.pending',
  blocked: 'common:memberStatus.blocked',
  rejected: 'common:memberStatus.rejected',
  // Convidado não é membro ainda: existe um convite com o nome dele e nenhuma conta atrás. A
  // linha aparece na lista para que quem convidou veja que o convite saiu, e some quando a
  // pessoa entra.
  invited: 'common:memberStatus.invited',
};

const MEMBER_SEMANTICS: Record<string, StatusSemantic> = {
  active: 'success',
  pending: 'pending',
  blocked: 'danger',
  rejected: 'neutral',
  invited: 'pending',
};

export function getDocumentStatusBadge(status: DocumentStatus): StatusBadgeConfig {
  const config = DOCUMENT_STATUSES[status];
  if (!config) {
    return { labelKey: status, semantic: 'neutral' };
  }

  const semanticMap: Record<string, StatusSemantic> = {
    success: 'success',
    info: 'info',
    warning: 'warning',
    danger: 'danger',
  };

  return {
    labelKey: config.labelKey,
    semantic: semanticMap[config.variant] ?? 'neutral',
  };
}

export function getMemberStatusBadge(status: string): StatusBadgeConfig {
  return {
    labelKey: MEMBER_LABEL_KEYS[status] ?? status,
    semantic: MEMBER_SEMANTICS[status] ?? 'neutral',
  };
}
