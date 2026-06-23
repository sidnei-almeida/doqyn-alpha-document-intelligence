export type MemberDragData = {
  type: 'member';
  memberId: string;
  sourceGroupId: string | null;
};

export type GroupDragData = {
  type: 'group';
  groupId: string;
};

export type DragData = MemberDragData | GroupDragData;

export const AVAILABLE_DROP_ID = 'available';
export function groupDropId(groupId: string) {
  return `group-${groupId}`;
}
export function categoryDropId(categoryId: string) {
  return `category-${categoryId}`;
}
export function groupChipId(groupId: string) {
  return `group-chip-${groupId}`;
}

export function parseGroupDropId(id: string): string | null {
  if (id.startsWith('group-') && !id.startsWith('group-chip-')) {
    return id.replace('group-', '');
  }
  return null;
}

export function parseCategoryDropId(id: string): string | null {
  if (id.startsWith('category-')) return id.replace('category-', '');
  return null;
}
