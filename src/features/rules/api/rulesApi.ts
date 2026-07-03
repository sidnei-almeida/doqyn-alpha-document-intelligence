import type {
  DocumentExtractionRule,
  ExtractionField,
  FieldType,
  GroupColor,
  MemberStatus,
  UserRole,
} from '@/types/rules';

import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';

const API_BASE = '/api';

export class RulesApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'RulesApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(options?.headers),
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : 'Não foi possível concluir a operação. Tente novamente.';
    throw new RulesApiError(message, response.status, data?.code);
  }

  return data as T;
}

// --- API response shapes ---

type ApiGroup = {
  id: string;
  companyId: string;
  name: string;
  slug?: string;
  description?: string | null;
  color: string;
  active: boolean;
  memberCount?: number;
  linkedClassCount?: number;
  linkedCategoryCount?: number;
  createdAt: string;
  updatedAt: string;
};

type ApiMember = {
  id: string;
  companyId: string;
  userId?: string;
  name: string;
  email: string;
  position?: string;
  role: string;
  status: MemberStatus;
  groupIds: string[];
  documentGroupIds?: string[];
  accessGroupIds?: string[];
  createdAt: string;
  updatedAt: string;
};

type ApiDocumentClass = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  iconKey?: string;
  color?: string;
  keywords: string[];
  negativeKeywords: string[];
  permissions: {
    view: string[];
    download: string[];
    update: string[];
    audit: string[];
    share: string[];
  };
  notifyOnUpdate: boolean;
  notifyGroups: string[];
  createdAt: string;
  updatedAt: string;
};

type ApiDocumentRule = {
  id: string;
  companyId: string;
  classId: string;
  version: number;
  active: boolean;
  fields: ExtractionField[];
  namingTemplate: string;
  minimumConfidence: number;
  onLowConfidence?: string;
  createdAt: string;
  updatedAt: string;
};

function unwrap<T>(data: Record<string, unknown>, keys: string[]): T {
  for (const key of keys) {
    if (data[key] !== undefined) return data[key] as T;
  }
  return data as T;
}

// --- Grupos documentais (MongoDB) ---

export async function getAccessGroups(): Promise<ApiGroup[]> {
  const data = await request<{ groups: ApiGroup[] }>('/document-groups');
  return data.groups ?? [];
}

export async function createAccessGroup(
  payload: { name: string; description?: string; color?: string },
): Promise<ApiGroup> {
  const data = await request<{ group: ApiGroup }>('/document-groups', {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, description: payload.description }),
  });
  return { ...unwrap<ApiGroup>(data as Record<string, unknown>, ['group']), color: payload.color ?? 'blue' };
}

export async function updateAccessGroup(
  id: string,
  payload: { name?: string; description?: string | null; active?: boolean },
): Promise<ApiGroup> {
  const data = await request<{ group: ApiGroup }>(`/document-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiGroup>(data as Record<string, unknown>, ['group']);
}

export async function toggleAccessGroup(id: string): Promise<{ id: string; active: boolean }> {
  const group = await updateAccessGroup(id, { active: false });
  return { id: group.id, active: group.active };
}

export async function deleteAccessGroup(id: string): Promise<void> {
  await request(`/document-groups/${id}`, { method: 'DELETE' });
}

export type AuthGroupMember = {
  membershipId: string;
  userId: string;
  displayName?: string;
  email?: string;
};

export async function getGroupMembers(groupId: string): Promise<AuthGroupMember[]> {
  const data = await request<{ members: AuthGroupMember[] }>(`/document-groups/${groupId}/members`);
  return data.members ?? [];
}

export async function addMemberToAccessGroup(
  groupId: string,
  membershipId: string,
  member: { userId: string; displayName?: string; email?: string },
): Promise<void> {
  await request(`/document-groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({
      documentGroupId: groupId,
      membershipId,
      memberId: membershipId,
      userId: member.userId,
      displayName: member.displayName,
      email: member.email,
    }),
  });
}

export async function removeMemberFromAccessGroup(
  groupId: string,
  membershipId: string,
): Promise<void> {
  await request(`/document-groups/${groupId}/members?membershipId=${encodeURIComponent(membershipId)}`, {
    method: 'DELETE',
  });
}

// --- Members ---

export async function getCompanyMembers(): Promise<ApiMember[]> {
  const data = await request<{ members: ApiMember[] }>('/company-members');
  return data.members ?? [];
}

export async function createCompanyMember(payload: {
  name: string;
  email: string;
  role?: UserRole;
  status?: MemberStatus;
  groupIds?: string[];
  position?: string;
}): Promise<ApiMember> {
  const data = await request<{ member: ApiMember }>('/company-members', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiMember>(data as Record<string, unknown>, ['member']);
}

export async function updateCompanyMember(
  id: string,
  payload: {
    name?: string;
    role?: UserRole;
    position?: string;
    status?: MemberStatus;
    groupIds?: string[];
  },
): Promise<ApiMember> {
  const data = await request<{ member: ApiMember }>(`/company-members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiMember>(data as Record<string, unknown>, ['member']);
}

export async function updateCompanyMemberStatus(
  id: string,
  status: MemberStatus,
): Promise<ApiMember> {
  const data = await request<{ member: ApiMember }>(`/company-members/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return unwrap<ApiMember>(data as Record<string, unknown>, ['member']);
}

export async function updateCompanyMemberGroups(
  id: string,
  groupIds: string[],
): Promise<ApiMember> {
  const data = await request<{ member: ApiMember }>(`/company-members/${id}/groups`, {
    method: 'PUT',
    body: JSON.stringify({ documentGroupIds: groupIds }),
  });
  return unwrap<ApiMember>(data as Record<string, unknown>, ['member']);
}

// --- Document classes ---

export async function getDocumentClasses(): Promise<ApiDocumentClass[]> {
  const data = await request<{ categories: ApiDocumentClass[] }>('/document-categories');
  const categories = data.categories ?? [];
  return categories.map((c) => ({
    ...c,
    permissions: c.permissions ?? { view: [], download: [], update: [], audit: [], share: [] },
  }));
}

export async function createDocumentClass(payload: {
  name: string;
  description?: string;
  keywords?: string[];
  negativeKeywords?: string[];
  iconKey?: string;
  color?: string;
}): Promise<ApiDocumentClass> {
  const data = await request<{ category: ApiDocumentClass }>('/document-categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const category = unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['category']);
  return {
    ...category,
    permissions: { view: [], download: [], update: [], audit: [], share: [] },
  };
}

export async function updateDocumentClass(
  id: string,
  payload: {
    name?: string;
    description?: string;
    keywords?: string[];
    negativeKeywords?: string[];
    iconKey?: string;
    color?: string;
    active?: boolean;
  },
): Promise<ApiDocumentClass> {
  const data = await request<{ category: ApiDocumentClass }>(`/document-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const category = unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['category']);
  return {
    ...category,
    permissions: category.permissions ?? { view: [], download: [], update: [], audit: [], share: [] },
  };
}

export async function toggleDocumentClass(id: string): Promise<ApiDocumentClass> {
  const data = await request<{ id: string; active: boolean }>(
    `/document-categories/${id}/toggle-active`,
    { method: 'PATCH' },
  );
  const classes = await getDocumentClasses();
  const found = classes.find((c) => c.id === data.id);
  if (!found) throw new RulesApiError('Categoria não encontrada.', 404);
  return { ...found, active: data.active };
}

export async function updateDocumentClassPermissions(
  id: string,
  viewGroupIds: string[],
): Promise<ApiDocumentClass> {
  const data = await request<{ class: ApiDocumentClass }>(`/document-classes/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ viewGroupIds }),
  });
  return unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['class']);
}

export async function updateDocumentClassNotifications(
  id: string,
  payload: { notifyOnUpdate: boolean; notifyGroups: string[] },
): Promise<ApiDocumentClass> {
  const data = await request<{ class: ApiDocumentClass }>(
    `/document-classes/${id}/notifications`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  return unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['class']);
}

// --- Regras de extração IA ---

export async function getDocumentRules(): Promise<ApiDocumentRule[]> {
  const data = await request<{ rules: ApiDocumentRule[] }>('/document-extraction-rules');
  return data.rules ?? [];
}

export async function createDocumentRule(payload: {
  classId: string;
  categoryId?: string;
  version?: number;
  active?: boolean;
  fields: ExtractionField[];
  namingTemplate: string;
  minimumConfidence?: number;
}): Promise<ApiDocumentRule> {
  const data = await request<{ rule: ApiDocumentRule }>('/document-extraction-rules', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      categoryId: payload.categoryId ?? payload.classId,
    }),
  });
  return unwrap<ApiDocumentRule>(data as Record<string, unknown>, ['rule']);
}

export async function updateDocumentRule(
  id: string,
  payload: {
    fields?: ExtractionField[];
    namingTemplate?: string;
    minimumConfidence?: number;
    active?: boolean;
    version?: number;
  },
): Promise<ApiDocumentRule> {
  const data = await request<{ rule: ApiDocumentRule }>(`/document-extraction-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiDocumentRule>(data as Record<string, unknown>, ['rule']);
}

export async function toggleDocumentRule(id: string): Promise<ApiDocumentRule> {
  return updateDocumentRule(id, { active: false });
}

export type DocumentAccessPermissions = {
  view: boolean;
  download: boolean;
  upload: boolean;
  share: boolean;
  manage: boolean;
};

export type DocumentAccessMatrix = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    active: boolean;
    linkedGroupCount: number;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description?: string | null;
    active: boolean;
    memberCount: number;
    linkedCategoryCount: number;
  }>;
  rules: Array<{
    id: string;
    groupId: string;
    categoryId: string;
    permissions: DocumentAccessPermissions;
    active: boolean;
  }>;
  extractionRules: ApiDocumentRule[];
  /** @deprecated use categories */
  classes?: DocumentAccessMatrix['categories'];
  /** @deprecated use rules */
  links?: Array<{
    groupId: string;
    classId: string;
    categoryId?: string;
    permissions: DocumentAccessPermissions;
  }>;
};

export async function getDocumentAccessMatrix(): Promise<DocumentAccessMatrix> {
  const matrix = await request<DocumentAccessMatrix>('/document-rules/matrix');
  const rules = matrix.rules ?? [];
  return {
    ...matrix,
    classes: matrix.categories,
    links: rules.map((rule) => ({
      groupId: rule.groupId,
      classId: rule.categoryId,
      categoryId: rule.categoryId,
      permissions: rule.permissions,
    })),
  };
}

export async function updateDocumentAccessMatrixCell(input: {
  groupId: string;
  classId: string;
  categoryId?: string;
  permissions: DocumentAccessPermissions;
}): Promise<{ groupId: string; classId: string; permissions: DocumentAccessPermissions }> {
  const categoryId = input.categoryId ?? input.classId;
  const result = await request<{
    groupId: string;
    categoryId: string;
    permissions: DocumentAccessPermissions;
  }>('/document-rules/matrix', {
    method: 'PUT',
    body: JSON.stringify({
      groupId: input.groupId,
      categoryId,
      permissions: input.permissions,
    }),
  });
  return { groupId: result.groupId, classId: result.categoryId, permissions: result.permissions };
}

export type { ApiGroup, ApiMember, ApiDocumentClass, ApiDocumentRule };

export const ALLOWED_FIELD_TYPES: FieldType[] = [
  'string',
  'date',
  'number',
  'currency',
  'boolean',
];

export const ALLOWED_GROUP_COLORS: GroupColor[] = ['blue', 'green', 'amber', 'red', 'purple'];

export function toExtractionRule(rule: ApiDocumentRule): DocumentExtractionRule {
  return {
    id: rule.id,
    classId: rule.classId,
    version: rule.version,
    active: rule.active,
    fields: rule.fields,
    namingTemplate: rule.namingTemplate,
    minimumConfidence: rule.minimumConfidence,
  };
}
