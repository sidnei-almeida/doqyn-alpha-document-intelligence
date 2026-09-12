import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';

export function getIconForCategoryName(name: string): import('@/types/rules').DocumentIcon {
  const lower = name.toLowerCase().trim();
  if (lower.includes('contrato') || lower.includes('acordo')) return 'file-text';
  if (lower.includes('nota') || lower.includes('fiscal') || lower.includes('nf')) return 'receipt';
  if (lower.includes('proposta') || lower.includes('orçamento')) return 'file-invoice';
  if (lower.includes('rh') || lower.includes('pessoal') || lower.includes('funcionário'))
    return 'users';
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
  return categories.filter((cat) => cat.documentGroupIds.some((id) => groupSet.has(id)));
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

/**
 * Estilo de uma cor da paleta de grupos. O tom vive em variável de tema
 * (`--group-*`), então claro e escuro desenham o mesmo grupo do seu jeito.
 */
export function groupColorVar(color: import('@shared/groupPalette').GroupColor): string {
  return `var(--group-${color})`;
}
