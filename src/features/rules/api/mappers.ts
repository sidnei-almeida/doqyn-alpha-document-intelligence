import type { ApiDocumentClass, ApiGroup, ApiMember } from '../api/rulesApi';
import type { DocumentCategory, DocumentIcon, Group, GroupColor, UserRole } from '@/types/rules';

const ICON_KEYS = new Set<DocumentIcon>([
  'file-text',
  'receipt',
  'file-invoice',
  'users',
  'chart-bar',
  'shield-check',
  'folder',
]);

function toDocumentIcon(iconKey?: string): DocumentIcon {
  if (iconKey && ICON_KEYS.has(iconKey as DocumentIcon)) {
    return iconKey as DocumentIcon;
  }
  return 'folder';
}

function toGroupColor(color?: string): GroupColor {
  const allowed: GroupColor[] = ['blue', 'green', 'amber', 'red', 'purple'];
  if (color && allowed.includes(color as GroupColor)) {
    return color as GroupColor;
  }
  return 'blue';
}

export function mapApiGroup(group: ApiGroup): Group {
  return {
    id: group.id,
    companyId: group.companyId,
    name: group.name,
    description: group.description ?? null,
    color: toGroupColor(group.color),
    active: group.active,
    memberCount: group.memberCount ?? 0,
    linkedClassCount: group.linkedClassCount ?? group.linkedCategoryCount ?? 0,
    createdAt: group.createdAt,
  };
}

export function mapApiDocumentClass(docClass: ApiDocumentClass): DocumentCategory {
  return {
    id: docClass.id,
    companyId: docClass.companyId,
    name: docClass.name,
    slug: docClass.slug,
    description: docClass.description,
    icon: toDocumentIcon(docClass.iconKey),
    iconKey: docClass.iconKey,
    color: docClass.color,
    active: docClass.active,
    accessGroupIds: docClass.permissions?.view ?? [],
    notifyGroupIds: docClass.notifyGroups ?? [],
    notifyOnUpdate: docClass.notifyOnUpdate ?? false,
    permissions: {
      view: docClass.permissions?.view ?? [],
      download: docClass.permissions?.download ?? [],
      update: docClass.permissions?.update ?? [],
      audit: docClass.permissions?.audit ?? [],
      share: docClass.permissions?.share ?? [],
    },
    keywords: docClass.keywords ?? [],
    negativeKeywords: docClass.negativeKeywords ?? [],
    createdAt: docClass.createdAt,
  };
}

export function mapApiMember(member: ApiMember) {
  const documentGroupIds = member.documentGroupIds ?? member.groupIds ?? [];
  return {
    id: member.id,
    companyId: member.companyId,
    userId: member.userId ?? member.id,
    name: member.name,
    email: member.email,
    position: member.position,
    role: member.role as UserRole,
    status: member.status,
    groupIds: documentGroupIds,
    createdAt: member.createdAt,
  };
}

export function filterActiveGroups(groups: Group[]): Group[] {
  return groups.filter((g) => g.active);
}

export function filterActiveCategories(categories: DocumentCategory[]): DocumentCategory[] {
  return categories.filter((c) => c.active);
}
