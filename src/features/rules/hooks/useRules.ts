import { useCallback, useMemo, useState } from 'react';
import type {
  AuditEvent,
  CompanyMember,
  DocumentCategory,
  Group,
  GroupColor,
  PendingApproval,
  UserRole,
} from '@/types/rules';
import {
  extractDomain,
  generateId,
  getIconForCategoryName,
} from '@/utils/rulesHelpers';
import {
  CURRENT_COMPANY_ID,
  CURRENT_USER_NAME,
  INITIAL_AUDIT_EVENTS,
  INITIAL_CATEGORIES,
  INITIAL_GROUPS,
  INITIAL_MEMBERS,
  INITIAL_PENDING_APPROVALS,
} from '../mockData';

export type InviteMemberInput = {
  name: string;
  email: string;
  position?: string;
  role: UserRole;
  groupIds: string[];
  message?: string;
};

// API endpoints futuros:
// GET    /api/companies/:companyId/groups
// GET    /api/companies/:companyId/members
// POST   /api/companies/:companyId/members/invite
// PATCH  /api/companies/:companyId/members/:memberId/groups
// PATCH  /api/companies/:companyId/members/:memberId/approve
// PATCH  /api/companies/:companyId/members/:memberId/reject
// PATCH  /api/companies/:companyId/members/:memberId/suspend
// DELETE /api/companies/:companyId/members/:memberId
// GET    /api/companies/:companyId/pending-approvals
// GET    /api/companies/:companyId/audit-events

function filterByCompany<T extends { companyId: string }>(items: T[]): T[] {
  return items.filter((item) => item.companyId === CURRENT_COMPANY_ID);
}

export function useRules() {
  const [groups, setGroups] = useState<Group[]>(() => filterByCompany(INITIAL_GROUPS));
  const [categories, setCategories] = useState<DocumentCategory[]>(() =>
    filterByCompany(INITIAL_CATEGORIES),
  );
  const [members, setMembers] = useState<CompanyMember[]>(() => filterByCompany(INITIAL_MEMBERS));
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(() =>
    filterByCompany(INITIAL_PENDING_APPROVALS),
  );
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() =>
    filterByCompany(INITIAL_AUDIT_EVENTS),
  );

  const addAuditEvent = useCallback((action: string, target: string) => {
    const event: AuditEvent = {
      id: generateId('aud'),
      companyId: CURRENT_COMPANY_ID,
      action,
      actor: CURRENT_USER_NAME,
      target,
      createdAt: new Date().toISOString(),
    };
    setAuditEvents((prev) => [event, ...prev]);
  }, []);

  const createGroup = useCallback(
    (name: string, color: GroupColor) => {
      const newGroup: Group = {
        id: generateId('grp'),
        companyId: CURRENT_COMPANY_ID,
        name: name.trim(),
        color,
        createdAt: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, newGroup]);
      addAuditEvent(`${CURRENT_USER_NAME} criou o grupo ${name.trim()}`, name.trim());
    },
    [addAuditEvent],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          accessGroupIds: cat.accessGroupIds.filter((id) => id !== groupId),
          notifyGroupIds: cat.notifyGroupIds.filter((id) => id !== groupId),
        })),
      );
      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          groupIds: m.groupIds.filter((id) => id !== groupId),
        })),
      );
      if (group) {
        addAuditEvent(`${CURRENT_USER_NAME} removeu o grupo ${group.name}`, group.name);
      }
    },
    [addAuditEvent, groups],
  );

  const createCategory = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const newCategory: DocumentCategory = {
        id: generateId('cat'),
        companyId: CURRENT_COMPANY_ID,
        name: trimmed,
        icon: getIconForCategoryName(trimmed),
        accessGroupIds: [],
        notifyGroupIds: [],
        createdAt: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, newCategory]);
      addAuditEvent(`${CURRENT_USER_NAME} criou a categoria ${trimmed}`, trimmed);
    },
    [addAuditEvent],
  );

  const deleteCategory = useCallback(
    (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      if (category) {
        addAuditEvent(`${CURRENT_USER_NAME} removeu a categoria ${category.name}`, category.name);
      }
    },
    [addAuditEvent, categories],
  );

  const assignGroupToCategory = useCallback(
    (categoryId: string, groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      const category = categories.find((c) => c.id === categoryId);

      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id !== categoryId) return cat;
          if (cat.accessGroupIds.includes(groupId)) return cat;
          return {
            ...cat,
            accessGroupIds: [...cat.accessGroupIds, groupId],
            notifyGroupIds: [...cat.notifyGroupIds, groupId],
          };
        }),
      );

      if (group && category) {
        addAuditEvent(
          `${CURRENT_USER_NAME} liberou a categoria ${category.name} para o grupo ${group.name}`,
          category.name,
        );
      }
    },
    [addAuditEvent, categories, groups],
  );

  const removeGroupFromCategory = useCallback(
    (categoryId: string, groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      const category = categories.find((c) => c.id === categoryId);

      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                accessGroupIds: cat.accessGroupIds.filter((id) => id !== groupId),
                notifyGroupIds: cat.notifyGroupIds.filter((id) => id !== groupId),
              }
            : cat,
        ),
      );

      if (group && category) {
        addAuditEvent(
          `${CURRENT_USER_NAME} removeu o acesso do grupo ${group.name} à categoria ${category.name}`,
          category.name,
        );
      }
    },
    [addAuditEvent, categories, groups],
  );

  const toggleAllNotifications = useCallback((categoryId: string, active: boolean) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          notifyGroupIds: active ? [...cat.accessGroupIds] : [],
        };
      }),
    );
  }, []);

  const inviteMember = useCallback(
    (input: InviteMemberInput) => {
      const trimmedName = input.name.trim();
      const trimmedEmail = input.email.trim().toLowerCase();
      if (!trimmedName || !trimmedEmail.includes('@')) return;

      const pending: PendingApproval = {
        id: generateId('pend'),
        companyId: CURRENT_COMPANY_ID,
        name: trimmedName,
        email: trimmedEmail,
        domain: extractDomain(trimmedEmail),
        requestedAt: new Date().toLocaleString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          day: 'numeric',
          month: 'short',
        }),
        method: 'invite',
        requestedGroups: input.groupIds,
        position: input.position,
        role: input.role,
      };

      setPendingApprovals((prev) => [pending, ...prev]);

      const existingMember = members.find((m) => m.email === trimmedEmail);
      if (!existingMember) {
        const newMember: CompanyMember = {
          id: generateId('mbr'),
          companyId: CURRENT_COMPANY_ID,
          name: trimmedName,
          email: trimmedEmail,
          position: input.position,
          role: input.role,
          status: 'pending',
          groupIds: [],
          createdAt: new Date().toISOString(),
        };
        setMembers((prev) => [...prev, newMember]);
      }

      addAuditEvent(`${CURRENT_USER_NAME} convidou ${trimmedName}`, trimmedName);
    },
    [addAuditEvent, members],
  );

  const approveMember = useCallback(
    (approvalId: string) => {
      const approval = pendingApprovals.find((p) => p.id === approvalId);
      if (!approval) return;

      setPendingApprovals((prev) => prev.filter((p) => p.id !== approvalId));

      const existing = members.find((m) => m.email === approval.email);
      const now = new Date().toISOString();

      if (existing) {
        setMembers((prev) =>
          prev.map((m) =>
            m.email === approval.email
              ? {
                  ...m,
                  status: 'active',
                  groupIds: [],
                  role: approval.role ?? m.role,
                  position: approval.position ?? m.position,
                  approvedBy: CURRENT_USER_NAME,
                  approvedAt: now,
                }
              : m,
          ),
        );
      } else {
        const newMember: CompanyMember = {
          id: generateId('mbr'),
          companyId: CURRENT_COMPANY_ID,
          name: approval.name,
          email: approval.email,
          position: approval.position,
          role: approval.role ?? 'member',
          status: 'active',
          groupIds: [],
          createdAt: now,
          approvedBy: CURRENT_USER_NAME,
          approvedAt: now,
        };
        setMembers((prev) => [...prev, newMember]);
      }

      addAuditEvent(`${CURRENT_USER_NAME} aprovou ${approval.name}`, approval.name);
    },
    [addAuditEvent, members, pendingApprovals],
  );

  const rejectMember = useCallback(
    (approvalId: string) => {
      const approval = pendingApprovals.find((p) => p.id === approvalId);
      if (!approval) return;

      setPendingApprovals((prev) => prev.filter((p) => p.id !== approvalId));
      setMembers((prev) => prev.filter((m) => m.email !== approval.email || m.status !== 'pending'));

      addAuditEvent(`${CURRENT_USER_NAME} recusou ${approval.name}`, approval.name);
    },
    [addAuditEvent, pendingApprovals],
  );

  const addMemberToGroup = useCallback(
    (memberId: string, groupId: string) => {
      const member = members.find((m) => m.id === memberId);
      const group = groups.find((g) => g.id === groupId);
      if (!member || !group) return;
      if (member.status !== 'active') return;
      if (member.groupIds.includes(groupId)) return;

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, groupIds: [...m.groupIds, groupId] } : m,
        ),
      );

      addAuditEvent(
        `${CURRENT_USER_NAME} adicionou ${member.name} ao grupo ${group.name}`,
        member.name,
      );
    },
    [addAuditEvent, groups, members],
  );

  const removeMemberFromGroup = useCallback(
    (memberId: string, groupId: string) => {
      const member = members.find((m) => m.id === memberId);
      const group = groups.find((g) => g.id === groupId);
      if (!member || !group) return;
      if (!member.groupIds.includes(groupId)) return;

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, groupIds: m.groupIds.filter((id) => id !== groupId) }
            : m,
        ),
      );

      addAuditEvent(
        `${CURRENT_USER_NAME} removeu ${member.name} do grupo ${group.name}`,
        member.name,
      );
    },
    [addAuditEvent, groups, members],
  );

  const updateMemberGroups = useCallback(
    (memberId: string, groupIds: string[]) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      const prevGroups = member.groupIds
        .map((id) => groups.find((g) => g.id === id)?.name)
        .filter(Boolean);
      const newGroups = groupIds.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean);

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, groupIds } : m)),
      );

      addAuditEvent(
        `${CURRENT_USER_NAME} alterou grupos de ${member.name} (${prevGroups.join(', ')} → ${newGroups.join(', ')})`,
        member.name,
      );
    },
    [addAuditEvent, groups, members],
  );

  const updateMemberRole = useCallback(
    (memberId: string, role: UserRole) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
      );

      addAuditEvent(
        `${CURRENT_USER_NAME} alterou perfil de ${member.name} para ${role}`,
        member.name,
      );
    },
    [addAuditEvent, members],
  );

  const suspendMember = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: 'suspended' } : m)),
      );

      addAuditEvent(`${CURRENT_USER_NAME} suspendeu acesso de ${member.name}`, member.name);
    },
    [addAuditEvent, members],
  );

  const removeMember = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setPendingApprovals((prev) => prev.filter((p) => p.email !== member.email));

      addAuditEvent(`${CURRENT_USER_NAME} removeu ${member.name} da empresa`, member.name);
    },
    [addAuditEvent, members],
  );

  const groupMemberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groups.forEach((g) => {
      counts[g.id] = 0;
    });
    members
      .filter((m) => m.status === 'active')
      .forEach((member) => {
        member.groupIds.forEach((groupId) => {
          if (counts[groupId] !== undefined) counts[groupId]++;
        });
      });
    return counts;
  }, [groups, members]);

  return {
    groups,
    categories,
    members,
    pendingApprovals,
    auditEvents,
    groupMemberCounts,
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
    updateMemberRole,
    suspendMember,
    removeMember,
  };
}
