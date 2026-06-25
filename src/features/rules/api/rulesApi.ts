import type {
  DocumentExtractionRule,
  ExtractionField,
  FieldType,
  GroupColor,
  MemberStatus,
  UserRole,
} from '@/types/rules';

import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { usesDoqynAuth } from '@/auth/authConfig';
import { authServiceJson } from '@/auth/authServiceClient';

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
  slug: string;
  color: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiMember = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  position?: string;
  role: string;
  status: MemberStatus;
  groupIds: string[];
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

// --- Groups ---

export async function getAccessGroups(tenantId?: string): Promise<ApiGroup[]> {
  if (usesDoqynAuth()) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const data = await authServiceJson<{
      groups: Array<{
        groupId: string;
        name: string;
        slug: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/admin/access-groups${query}`);
    return (data.groups ?? []).map((g) => ({
      id: g.groupId,
      companyId: tenantId ?? '',
      name: g.name,
      slug: g.slug,
      color: 'blue',
      active: g.status === 'active',
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  }

  const data = await request<{ groups: ApiGroup[] }>('/access-groups');
  return data.groups ?? [];
}

export async function createAccessGroup(
  payload: { name: string; color?: string },
  tenantId?: string,
): Promise<ApiGroup> {
  if (usesDoqynAuth()) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const slug = payload.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const data = await authServiceJson<{ group: { groupId: string; name: string; slug: string; status: string; createdAt: string; updatedAt: string } }>(
      `/admin/access-groups${query}`,
      {
        method: 'POST',
        body: JSON.stringify({ slug, name: payload.name }),
      },
    );
    const g = data.group;
    return {
      id: g.groupId,
      companyId: tenantId ?? '',
      name: g.name,
      slug: g.slug,
      color: payload.color ?? 'blue',
      active: g.status === 'active',
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  const data = await request<{ group: ApiGroup }>('/access-groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiGroup>(data as Record<string, unknown>, ['group']);
}

export async function updateAccessGroup(
  id: string,
  payload: { name?: string; color?: string; active?: boolean },
): Promise<ApiGroup> {
  const data = await request<{ group: ApiGroup }>(`/access-groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiGroup>(data as Record<string, unknown>, ['group']);
}

export async function toggleAccessGroup(id: string): Promise<{ id: string; active: boolean }> {
  return request(`/access-groups/${id}/toggle-active`, { method: 'PATCH' });
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
    body: JSON.stringify({ groupIds }),
  });
  return unwrap<ApiMember>(data as Record<string, unknown>, ['member']);
}

// --- Document classes ---

export async function getDocumentClasses(): Promise<ApiDocumentClass[]> {
  const data = await request<{ classes: ApiDocumentClass[] }>('/document-classes');
  return data.classes ?? [];
}

export async function createDocumentClass(payload: {
  name: string;
  description?: string;
  keywords?: string[];
  negativeKeywords?: string[];
  iconKey?: string;
  color?: string;
}): Promise<ApiDocumentClass> {
  const data = await request<{ class: ApiDocumentClass }>('/document-classes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['class']);
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
  },
): Promise<ApiDocumentClass> {
  const data = await request<{ class: ApiDocumentClass }>(`/document-classes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['class']);
}

export async function toggleDocumentClass(id: string): Promise<ApiDocumentClass> {
  const data = await request<{ class: ApiDocumentClass }>(
    `/document-classes/${id}/toggle-active`,
    { method: 'PATCH' },
  );
  return unwrap<ApiDocumentClass>(data as Record<string, unknown>, ['class']);
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

// --- Document rules ---

export async function getDocumentRules(): Promise<ApiDocumentRule[]> {
  const data = await request<{ rules: ApiDocumentRule[] }>('/document-rules');
  return data.rules ?? [];
}

export async function createDocumentRule(payload: {
  classId: string;
  version?: number;
  active?: boolean;
  fields: ExtractionField[];
  namingTemplate: string;
  minimumConfidence?: number;
}): Promise<ApiDocumentRule> {
  const data = await request<{ rule: ApiDocumentRule }>('/document-rules', {
    method: 'POST',
    body: JSON.stringify(payload),
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
  const data = await request<{ rule: ApiDocumentRule }>(`/document-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return unwrap<ApiDocumentRule>(data as Record<string, unknown>, ['rule']);
}

export async function toggleDocumentRule(id: string): Promise<ApiDocumentRule> {
  const data = await request<{ rule: ApiDocumentRule }>(`/document-rules/${id}/toggle-active`, {
    method: 'PATCH',
  });
  return unwrap<ApiDocumentRule>(data as Record<string, unknown>, ['rule']);
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
