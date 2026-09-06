import type { DocumentStatus } from '@/types/document';
import { DOCUMENT_STATUSES } from '@/lib/constants';
import { STATUS_LABELS as RULES_MEMBER_STATUS_LABELS } from '@/utils/rulesHelpers';

export type StatusSemantic =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'pending'
  | 'neutral';

export type StatusBadgeConfig = {
  label: string;
  semantic: StatusSemantic;
};

const MEMBER_LABELS: Record<string, string> = {
  ...RULES_MEMBER_STATUS_LABELS,
  rejected: 'Rejeitado',
  // Convidado não é membro ainda: existe um convite com o nome dele e nenhuma conta atrás. A
  // linha aparece na lista para que quem convidou veja que o convite saiu, e some quando a
  // pessoa entra.
  invited: 'Convidado',
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
    return { label: status, semantic: 'neutral' };
  }

  const semanticMap: Record<string, StatusSemantic> = {
    success: 'success',
    info: 'info',
    warning: 'warning',
    danger: 'danger',
  };

  return {
    label: config.label,
    semantic: semanticMap[config.variant] ?? 'neutral',
  };
}

export function getMemberStatusBadge(status: string): StatusBadgeConfig {
  return {
    label: MEMBER_LABELS[status] ?? status,
    semantic: MEMBER_SEMANTICS[status] ?? 'neutral',
  };
}
