import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import type {
  AuditEvent,
  CompanyMember,
  DocumentCategory,
  DocumentExtractionRule,
  Group,
  GroupColor,
  PendingApproval,
  UserRole,
} from '@/types/rules';
import { computeGroupMemberCounts, extractDomain, generateId } from '@/utils/rulesHelpers';
import {
  createAccessGroup,
  createCompanyMember,
  createDocumentClass,
  createDocumentRule,
  getAccessGroups,
  getCompanyMembers,
  getDocumentClasses,
  getDocumentRules,
  RulesApiError,
  toggleAccessGroup,
  toggleDocumentClass,
  toExtractionRule,
  updateCompanyMemberGroups,
  updateCompanyMemberStatus,
  updateDocumentClass,
  updateDocumentClassNotifications,
  updateDocumentClassPermissions,
  updateDocumentRule,
} from '../api/rulesApi';
import {
  filterActiveCategories,
  filterActiveGroups,
  mapApiDocumentClass,
  mapApiGroup,
  mapApiMember,
} from '../api/mappers';

export type InviteMemberInput = {
  name: string;
  email: string;
  position?: string;
  role: UserRole;
  groupIds: string[];
  message?: string;
};

function memberToPendingApproval(member: CompanyMember): PendingApproval {
  return {
    id: member.id,
    companyId: member.companyId,
    name: member.name,
    email: member.email,
    domain: extractDomain(member.email),
    requestedAt: new Date(member.createdAt).toLocaleString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    method: 'access_request',
    requestedGroups: [],
    position: member.position,
    role: member.role,
  };
}

function handleApiError(error: unknown, fallback: string) {
  const message = error instanceof RulesApiError ? error.message : fallback;
  toast.error(message);
}

export function useRules(actorName: string) {
  const { tenant } = useAuth();
  const tenantId = tenant?.tenantId;
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [rules, setRules] = useState<DocumentExtractionRule[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addAuditEvent = useCallback(
    (action: string, target: string) => {
      const event: AuditEvent = {
        id: generateId('aud'),
        companyId: members[0]?.companyId ?? '',
        action,
        actor: actorName,
        target,
        createdAt: new Date().toISOString(),
      };
      setAuditEvents((prev) => [event, ...prev]);
    },
    [actorName, members],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawGroups, rawClasses, rawMembers, rawRules] = await Promise.all([
        getAccessGroups(tenantId),
        getDocumentClasses(),
        getCompanyMembers(),
        getDocumentRules(),
      ]);

      setGroups(filterActiveGroups(rawGroups.map(mapApiGroup)));
      setCategories(filterActiveCategories(rawClasses.map(mapApiDocumentClass)));
      setMembers(rawMembers.map(mapApiMember));
      setRules(rawRules.map(toExtractionRule));
    } catch (err) {
      console.error('Falha ao carregar regras:', err);
      setError('Não foi possível carregar as regras agora.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pendingApprovals = useMemo(
    () => members.filter((m) => m.status === 'pending').map(memberToPendingApproval),
    [members],
  );

  const groupMemberCounts = useMemo(
    () => computeGroupMemberCounts(groups, members),
    [groups, members],
  );

  const createGroup = useCallback(
    async (name: string, color: GroupColor) => {
      try {
        const created = await createAccessGroup({ name, color }, tenantId);
        const mapped = mapApiGroup(created);
        setGroups((prev) => [...prev, mapped]);
        addAuditEvent(`${actorName} criou o grupo ${name.trim()}`, name.trim());
        toast.success('Grupo criado.');
      } catch (err) {
        handleApiError(err, 'Não foi possível criar o grupo.');
      }
    },
    [actorName, addAuditEvent],
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      try {
        await toggleAccessGroup(groupId);
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            accessGroupIds: cat.accessGroupIds.filter((id) => id !== groupId),
            notifyGroupIds: cat.notifyGroupIds.filter((id) => id !== groupId),
          })),
        );
        if (group) {
          addAuditEvent(`${actorName} desativou o grupo ${group.name}`, group.name);
        }
        toast.success('Grupo desativado.');
      } catch (err) {
        handleApiError(err, 'Não foi possível desativar o grupo.');
      }
    },
    [actorName, addAuditEvent, groups],
  );

  const createCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      try {
        const created = await createDocumentClass({ name: trimmed });
        const mapped = mapApiDocumentClass(created);
        setCategories((prev) => [...prev, mapped]);
        addAuditEvent(`${actorName} criou a categoria ${trimmed}`, trimmed);
        toast.success('Categoria criada.');
      } catch (err) {
        handleApiError(err, 'Não foi possível criar a categoria.');
      }
    },
    [actorName, addAuditEvent],
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      try {
        await toggleDocumentClass(categoryId);
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        if (category) {
          addAuditEvent(`${actorName} desativou a categoria ${category.name}`, category.name);
        }
        toast.success('Categoria desativada.');
      } catch (err) {
        handleApiError(err, 'Não foi possível desativar a categoria.');
      }
    },
    [actorName, addAuditEvent, categories],
  );

  const assignGroupToCategory = useCallback(
    async (categoryId: string, groupId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      const group = groups.find((g) => g.id === groupId);
      if (!category || category.accessGroupIds.includes(groupId)) return;

      const viewGroupIds = [...category.accessGroupIds, groupId];
      try {
        const updated = await updateDocumentClassPermissions(categoryId, viewGroupIds);
        const mapped = mapApiDocumentClass(updated);
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? mapped : c)));
        if (group && category) {
          addAuditEvent(
            `${actorName} liberou a categoria ${category.name} para o grupo ${group.name}`,
            category.name,
          );
        }
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar permissões.');
      }
    },
    [actorName, addAuditEvent, categories, groups],
  );

  const removeGroupFromCategory = useCallback(
    async (categoryId: string, groupId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      const group = groups.find((g) => g.id === groupId);
      if (!category) return;

      const viewGroupIds = category.accessGroupIds.filter((id) => id !== groupId);
      const notifyGroups = category.notifyGroupIds.filter((id) => id !== groupId);

      try {
        const [perms, notif] = await Promise.all([
          updateDocumentClassPermissions(categoryId, viewGroupIds),
          updateDocumentClassNotifications(categoryId, {
            notifyOnUpdate: category.notifyOnUpdate && notifyGroups.length > 0,
            notifyGroups,
          }),
        ]);
        const mapped = mapApiDocumentClass({
          ...notif,
          permissions: perms.permissions,
        });
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? mapped : c)));
        if (group && category) {
          addAuditEvent(
            `${actorName} removeu o acesso do grupo ${group.name} à categoria ${category.name}`,
            category.name,
          );
        }
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar permissões.');
      }
    },
    [actorName, addAuditEvent, categories, groups],
  );

  const toggleAllNotifications = useCallback(
    async (categoryId: string, active: boolean) => {
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return;

      const notifyGroups = active ? [...category.accessGroupIds] : [];
      try {
        const updated = await updateDocumentClassNotifications(categoryId, {
          notifyOnUpdate: active,
          notifyGroups,
        });
        const mapped = mapApiDocumentClass(updated);
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? mapped : c)));
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar notificações.');
      }
    },
    [categories],
  );

  const inviteMember = useCallback(
    async (input: InviteMemberInput) => {
      const trimmedName = input.name.trim();
      const trimmedEmail = input.email.trim().toLowerCase();
      if (!trimmedName || !trimmedEmail.includes('@')) return;

      try {
        const created = await createCompanyMember({
          name: trimmedName,
          email: trimmedEmail,
          role: input.role,
          status: 'pending',
          position: input.position,
          groupIds: [],
        });
        setMembers((prev) => [...prev, mapApiMember(created)]);
        addAuditEvent(`${actorName} convidou ${trimmedName}`, trimmedName);
        toast.success('Convite registrado.');
      } catch (err) {
        handleApiError(err, 'Não foi possível convidar o membro.');
      }
    },
    [actorName, addAuditEvent],
  );

  const approveMember = useCallback(
    async (approvalId: string) => {
      const member = members.find((m) => m.id === approvalId);
      if (!member) return;

      try {
        const updated = await updateCompanyMemberStatus(approvalId, 'active');
        setMembers((prev) => prev.map((m) => (m.id === approvalId ? mapApiMember(updated) : m)));
        addAuditEvent(`${actorName} aprovou ${member.name}`, member.name);
        toast.success('Membro aprovado.');
      } catch (err) {
        handleApiError(err, 'Não foi possível aprovar o membro.');
      }
    },
    [actorName, addAuditEvent, members],
  );

  const rejectMember = useCallback(
    async (approvalId: string) => {
      const member = members.find((m) => m.id === approvalId);
      if (!member) return;

      try {
        const updated = await updateCompanyMemberStatus(approvalId, 'blocked');
        setMembers((prev) => prev.map((m) => (m.id === approvalId ? mapApiMember(updated) : m)));
        addAuditEvent(`${actorName} recusou ${member.name}`, member.name);
        toast.success('Solicitação recusada.');
      } catch (err) {
        handleApiError(err, 'Não foi possível recusar o membro.');
      }
    },
    [actorName, addAuditEvent, members],
  );

  const persistMemberGroups = useCallback(
    async (memberId: string, groupIds: string[]) => {
      const updated = await updateCompanyMemberGroups(memberId, groupIds);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? mapApiMember(updated) : m)));
      return mapApiMember(updated);
    },
    [],
  );

  const addMemberToGroup = useCallback(
    async (memberId: string, groupId: string) => {
      const member = members.find((m) => m.id === memberId);
      const group = groups.find((g) => g.id === groupId);
      if (!member || !group) return;
      if (member.status !== 'active') return;
      if (member.groupIds.includes(groupId)) return;

      try {
        await persistMemberGroups(memberId, [...member.groupIds, groupId]);
        addAuditEvent(
          `${actorName} adicionou ${member.name} ao grupo ${group.name}`,
          member.name,
        );
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar grupos do membro.');
      }
    },
    [actorName, addAuditEvent, groups, members, persistMemberGroups],
  );

  const removeMemberFromGroup = useCallback(
    async (memberId: string, groupId: string) => {
      const member = members.find((m) => m.id === memberId);
      const group = groups.find((g) => g.id === groupId);
      if (!member || !group) return;
      if (!member.groupIds.includes(groupId)) return;

      try {
        await persistMemberGroups(
          memberId,
          member.groupIds.filter((id) => id !== groupId),
        );
        addAuditEvent(
          `${actorName} removeu ${member.name} do grupo ${group.name}`,
          member.name,
        );
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar grupos do membro.');
      }
    },
    [actorName, addAuditEvent, groups, members, persistMemberGroups],
  );

  const updateMemberGroups = useCallback(
    async (memberId: string, groupIds: string[]) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      try {
        await persistMemberGroups(memberId, groupIds);
        addAuditEvent(`${actorName} alterou grupos de ${member.name}`, member.name);
        toast.success('Grupos atualizados.');
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar grupos.');
      }
    },
    [actorName, addAuditEvent, members, persistMemberGroups],
  );

  const blockMember = useCallback(
    async (memberId: string) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      try {
        const updated = await updateCompanyMemberStatus(memberId, 'blocked');
        setMembers((prev) => prev.map((m) => (m.id === memberId ? mapApiMember(updated) : m)));
        addAuditEvent(`${actorName} bloqueou acesso de ${member.name}`, member.name);
        toast.success('Acesso bloqueado.');
      } catch (err) {
        handleApiError(err, 'Não foi possível bloquear o membro.');
      }
    },
    [actorName, addAuditEvent, members],
  );

  const saveExtractionRule = useCallback(
    async (
      classId: string,
      payload: {
        description?: string;
        keywords: string[];
        negativeKeywords: string[];
        fields: DocumentExtractionRule['fields'];
        namingTemplate: string;
        minimumConfidence: number;
        active: boolean;
      },
    ) => {
      try {
        await updateDocumentClass(classId, {
          description: payload.description,
          keywords: payload.keywords,
          negativeKeywords: payload.negativeKeywords,
        });

        const existing = rules.find((r) => r.classId === classId);
        let savedRule: DocumentExtractionRule;

        if (existing) {
          const updated = await updateDocumentRule(existing.id, {
            fields: payload.fields,
            namingTemplate: payload.namingTemplate,
            minimumConfidence: payload.minimumConfidence,
            active: payload.active,
          });
          savedRule = toExtractionRule(updated);
          setRules((prev) => prev.map((r) => (r.id === existing.id ? savedRule : r)));
        } else {
          const created = await createDocumentRule({
            classId,
            version: 1,
            active: payload.active,
            fields: payload.fields,
            namingTemplate: payload.namingTemplate,
            minimumConfidence: payload.minimumConfidence,
          });
          savedRule = toExtractionRule(created);
          setRules((prev) => [...prev, savedRule]);
        }

        setCategories((prev) =>
          prev.map((c) =>
            c.id === classId
              ? {
                  ...c,
                  description: payload.description,
                  keywords: payload.keywords,
                  negativeKeywords: payload.negativeKeywords,
                }
              : c,
          ),
        );

        addAuditEvent(
          `${actorName} atualizou configuração de extração`,
          categories.find((c) => c.id === classId)?.name ?? classId,
        );
        toast.success('Configuração salva.');
        return savedRule;
      } catch (err) {
        handleApiError(err, 'Não foi possível salvar a configuração.');
        return null;
      }
    },
    [actorName, addAuditEvent, categories, rules],
  );

  const getRuleForClass = useCallback(
    (classId: string) => rules.find((r) => r.classId === classId) ?? null,
    [rules],
  );

  return {
    groups,
    categories,
    members,
    rules,
    pendingApprovals,
    auditEvents,
    groupMemberCounts,
    loading,
    error,
    reload,
    createGroup,
    deleteGroup,
    createCategory,
    deleteCategory,
    assignGroupToCategory,
    removeGroupFromCategory,
    toggleAllNotifications,
    inviteMember,
    approveMember,
    rejectMember,
    addMemberToGroup,
    removeMemberFromGroup,
    updateMemberGroups,
    blockMember,
    saveExtractionRule,
    getRuleForClass,
  };
}
