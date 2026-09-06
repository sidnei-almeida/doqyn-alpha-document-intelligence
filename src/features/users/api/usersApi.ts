import { authFetch, getFetchCredentials } from '@/auth/apiAuth';
import { usesDoqynAuth } from '@/auth/authConfig';
import { doqynUsersApi } from './doqynUsersApi';

const API_BASE = '/api';

export type PlatformRole = 'company_admin' | 'individual_admin' | 'user';
/**
 * `invited` não é status de membership — é a ausência dela.
 *
 * A linha vem de um convite pendente no auth-service, e existe para que quem convidou veja que o
 * convite saiu em vez de encarar uma lista onde nada mudou. Quando a pessoa aceita, o convite sai
 * da lista de pendentes e o membro real toma o lugar.
 */
export type MemberStatus = 'invited' | 'pending' | 'active' | 'blocked' | 'rejected';

export type NotificationPreferencesDto = {
  email: boolean;
  whatsapp: boolean;
  documentCreated: boolean;
  documentUpdated: boolean;
  documentRequiresSignature: boolean;
  documentShared: boolean;
  accessApproved: boolean;
  accessRejected: boolean;
};

export type RequestedAccessDto = {
  personType?: 'individual' | 'business';
  taxIdType?: 'CPF' | 'CNPJ';
  taxIdMasked?: string;
  tenantDisplayName?: string;
  jobTitle?: string;
  departmentText?: string;
  reason?: string;
  requestedAt?: string;
  source?: string;
};

export type MemberConsentDto = {
  textVersion?: string;
  acceptedAt?: string;
  operationalNotificationsConsent?: boolean;
};

export type MemberTermsDto = {
  accepted?: boolean;
  version?: string | null;
  acceptedAt?: string;
};

export type CompanyMemberDto = {
  id: string;
  companyId: string;
  tenantId?: string;
  /**
   * O id do usuário no auth — é ele que a sessão carrega e que a autorização compara.
   *
   * `id` é o da associação (membership) e não serve para comparar com `user.id`: confundir os dois
   * faz um filtro de "não eu" nunca casar, e manda o id errado para o servidor.
   */
  userId?: string;
  authUserId?: string;
  username?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  whatsapp?: string;
  platformRoles: PlatformRole[];
  tenantRoles?: PlatformRole[];
  status: MemberStatus;
  accessGroupIds: string[];
  /** Grupos documentais do app principal (Mongo). */
  documentGroupIds: string[];
  /** @deprecated use documentGroupIds */
  groupIds: string[];
  requestedAccess?: RequestedAccessDto;
  consent?: MemberConsentDto;
  terms?: MemberTermsDto;
  notificationPreferences?: NotificationPreferencesDto;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDto = {
  email: true,
  whatsapp: true,
  documentCreated: true,
  documentUpdated: true,
  documentRequiresSignature: true,
  documentShared: true,
  accessApproved: true,
  accessRejected: true,
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    credentials: getFetchCredentials(),
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.message === 'string' ? data.message : 'Não foi possível concluir a operação.';
    throw new Error(message);
  }

  return data as T;
}

type GovernanceMemberApi = {
  id: string;
  companyId: string;
  tenantId?: string;
  /** O id do usuário no auth, que o servidor já manda em toda listagem de membros. */
  userId?: string;
  authUserId?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  whatsapp?: string;
  platformRoles?: PlatformRole[];
  status: MemberStatus;
  accessGroupIds?: string[];
  documentGroupIds?: string[];
  groupIds?: string[];
  requestedAccess?: RequestedAccessDto;
  consent?: MemberConsentDto;
  terms?: MemberTermsDto;
  notificationPreferences?: NotificationPreferencesDto;
  createdAt: string;
  updatedAt: string;
};

function mapGovernanceMember(member: GovernanceMemberApi): CompanyMemberDto {
  const documentGroupIds = member.documentGroupIds ?? member.groupIds ?? [];
  return {
    id: member.id,
    companyId: member.companyId,
    tenantId: member.tenantId ?? member.companyId,
    // O servidor manda os dois; o mapa os descartava, e todo consumidor acabava comparando o id da
    // associação com o id do usuário. Nenhuma comparação de "sou eu" ou "é o dono" casava.
    userId: member.userId ?? member.authUserId,
    authUserId: member.authUserId,
    email: member.email,
    name: member.name,
    firstName: member.firstName,
    lastName: member.lastName,
    whatsapp: member.whatsapp,
    platformRoles: member.platformRoles ?? ['user'],
    tenantRoles: member.platformRoles ?? ['user'],
    status: member.status,
    accessGroupIds: member.accessGroupIds ?? [],
    documentGroupIds,
    groupIds: documentGroupIds,
    requestedAccess: member.requestedAccess,
    consent: member.consent,
    terms: member.terms,
    notificationPreferences: member.notificationPreferences,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export const usersApi = {
  list: async (companyId?: string) => {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const data = await request<{ members: GovernanceMemberApi[] }>(`/company-members${query}`);
    return { members: (data.members ?? []).map(mapGovernanceMember) };
  },

  invite: (input: {
    companyId?: string;
    email: string;
    firstName: string;
    lastName: string;
    platformRoles: PlatformRole[];
    accessGroupIds: string[];
  }) => {
    if (usesDoqynAuth()) {
      // Sem chamador desde `5ac8ae2`, quando o convite saiu da tela de Usuários — e de propósito
      // preservado: a rota `/api/company-members/invite` continua no ar, o auth-service emite o
      // token, e o e-mail de convite é um dos que ganharam a marca. É a ligação que a tela nova
      // vai usar quando voltar, não sobra de refatoração.
      return doqynUsersApi.invite(input);
    }
    return request<{ member: CompanyMemberDto; temporaryPassword?: string }>(
      '/company-members/invite',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Registra os grupos que o convidado recebe ao aceitar.
   *
   * Chamada depois de o convite existir. Os grupos que governam vivem no Mongo, e no instante
   * do convite ainda não há membership a que vinculá-los — a intenção fica guardada e o sync
   * a aplica quando a pessoa entra.
   *
   * `documentGroupIds`, o mesmo nome que o "Editar acesso" usa, e não `accessGroupIds`: este é o
   * grupo do Mongo, o que decide o que a pessoa alcança. `accessGroupIds` é o registro do
   * auth-service, que a governança não consulta — vocabulário trocado aqui foi o que fez a
   * mesma decisão ser gravada em dois lugares.
   */
  storeInviteGroups: (input: { email: string; documentGroupIds: string[]; companyId?: string }) =>
    request<{ ok: boolean }>('/company-members/invite-groups', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /**
   * Quem foi convidado e ainda não entrou, para a lista mostrar a pessoa antes da conta existir.
   *
   * Só no provedor doqyn_auth: é lá que o convite vive. No caminho legado não há convite a listar,
   * e devolver lista vazia é a resposta certa — não é erro, é ausência.
   */
  listPendingInvites: (companyId?: string) =>
    usesDoqynAuth() ? doqynUsersApi.listPendingInvites(companyId) : Promise.resolve([]),

  revokeInvite: (inviteId: string) => doqynUsersApi.revokeInvite(inviteId),

  approve: (
    memberId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      documentGroupIds?: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
    tenantId?: string,
  ) => {
    void tenantId;
    return request<{ member: CompanyMemberDto; temporaryPassword?: string }>(
      `/company-members/${memberId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          platformRoles: input.platformRoles,
          accessGroupIds: input.accessGroupIds,
          documentGroupIds: input.documentGroupIds ?? [],
          notificationPreferences: input.notificationPreferences,
        }),
      },
    );
  },

  reject: (memberId: string, reason?: string, tenantId?: string) => {
    void tenantId;
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  block: (memberId: string, tenantId?: string, reason?: string) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.block(memberId, tenantId, reason);
    }
    const body: Record<string, string> = {};
    if (reason?.trim()) body.reason = reason.trim();
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/block`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  activate: (memberId: string, tenantId?: string) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.activate(memberId, tenantId);
    }
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  updateAccess: (
    memberId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
    tenantId?: string,
  ) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.updateAccess(memberId, input, tenantId);
    }
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/access`, {
      method: 'PATCH',
      body: JSON.stringify({
        tenantRoles: input.platformRoles,
        accessGroupIds: input.accessGroupIds,
        notificationPreferences: input.notificationPreferences,
      }),
    });
  },

  listAccessGroups: (tenantId?: string) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.listAccessGroups(tenantId);
    }
    return request<{ groups: Array<{ id: string; name: string }> }>('/access-groups').then(
      (data) => data.groups ?? [],
    );
  },

  listDocumentGroups: async (): Promise<
    Array<{ id: string; name: string; description?: string; memberCount?: number }>
  > => {
    const data = await request<{
      groups: Array<{ id: string; name: string; description?: string; memberCount?: number }>;
    }>('/document-groups');
    return (data.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.memberCount ?? 0,
    }));
  },

  updateDocumentGroups: async (
    memberId: string,
    documentGroupIds: string[],
    tenantId?: string,
  ): Promise<CompanyMemberDto> => {
    void tenantId;
    const data = await request<{ member: GovernanceMemberApi }>(
      `/company-members/${memberId}/groups`,
      {
        method: 'PUT',
        body: JSON.stringify({ documentGroupIds }),
      },
    );
    return mapGovernanceMember(data.member);
  },
};

export function suggestGroupsFromDepartment(
  departmentText: string | undefined,
  groups: Array<{ id: string; name: string }>,
): string[] {
  if (!departmentText?.trim()) return [];
  const normalized = departmentText.trim().toLowerCase();
  return groups
    .filter(
      (group) =>
        group.name.toLowerCase().includes(normalized) ||
        normalized.includes(group.name.toLowerCase()),
    )
    .map((group) => group.id);
}
