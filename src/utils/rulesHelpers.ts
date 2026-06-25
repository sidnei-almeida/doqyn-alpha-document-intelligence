import type {
  CompanyMember,
  DocumentCategory,
  Group,
  MemberStatus,
  UserRole,
} from '@/types/rules';

export function getIconForCategoryName(name: string): import('@/types/rules').DocumentIcon {
  const lower = name.toLowerCase().trim();
  if (lower.includes('contrato') || lower.includes('acordo')) return 'file-text';
  if (lower.includes('nota') || lower.includes('fiscal') || lower.includes('nf')) return 'receipt';
  if (lower.includes('proposta') || lower.includes('orçamento')) return 'file-invoice';
  if (lower.includes('rh') || lower.includes('pessoal') || lower.includes('funcionário')) return 'users';
  if (lower.includes('financeiro') || lower.includes('relatório') || lower.includes('balanço')) {
    return 'chart-bar';
  }
  if (lower.includes('auditoria') || lower.includes('compliance') || lower.includes('política')) {
    return 'shield-check';
  }
  return 'folder';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function extractDomain(email: string): string {
  return email.split('@')[1] ?? '';
}

export function getAccessibleCategories(
  member: CompanyMember,
  categories: DocumentCategory[],
): DocumentCategory[] {
  if (member.status !== 'active') return [];

  const groupSet = new Set(member.groupIds);
  return categories.filter((cat) => cat.accessGroupIds.some((id) => groupSet.has(id)));
}

export function computeGroupMemberCounts(
  groups: Group[],
  members: CompanyMember[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  groups.forEach((g) => {
    counts[g.id] = 0;
  });

  members
    .filter((m) => m.status === 'active')
    .forEach((member) => {
      member.groupIds.forEach((groupId) => {
        if (counts[groupId] !== undefined) {
          counts[groupId]++;
        }
      });
    });

  return counts;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  member: 'Membro',
  auditor: 'Auditor',
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  blocked: 'Bloqueado',
};

export const GROUP_COLOR_STYLES: Record<
  import('@/types/rules').GroupColor,
  { border: string; badge: string; avatar: string; dot: string }
> = {
  blue: {
    border: 'border-doqyn-border-strong',
    badge: 'border-doqyn-border bg-doqyn-accent-active-bg text-doqyn-text',
    avatar: 'bg-doqyn-accent-active-bg text-doqyn-text',
    dot: 'bg-doqyn-text',
  },
  green: {
    border: 'border-doqyn-success-border',
    badge: 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success',
    avatar: 'bg-doqyn-success-bg text-doqyn-success',
    dot: 'bg-doqyn-success',
  },
  amber: {
    border: 'border-doqyn-warning-border',
    badge: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
    avatar: 'bg-doqyn-warning-bg text-doqyn-warning',
    dot: 'bg-doqyn-warning',
  },
  red: {
    border: 'border-doqyn-danger-border',
    badge: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
    avatar: 'bg-doqyn-danger-bg text-doqyn-danger',
    dot: 'bg-doqyn-danger',
  },
  purple: {
    border: 'border-doqyn-border-strong',
    badge: 'border-doqyn-border bg-doqyn-card text-doqyn-muted',
    avatar: 'bg-doqyn-card text-doqyn-muted',
    dot: 'bg-doqyn-subtle',
  },
};
