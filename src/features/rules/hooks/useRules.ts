import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';
import type {
  AuditEvent,
  CompanyMember,
  DocumentCategory,
  DocumentExtractionRule,
  ExpiryAlertConfig,
  Group,
  GroupColor,
} from '@/types/rules';
import { computeGroupMemberCounts, generateId } from '@/utils/rulesHelpers';
import {
  createDocumentGroup,
  createDocumentClass,
  createDocumentRule,
  getDocumentGroups,
  getDocumentAccessMatrix,
  getDocumentClasses,
  getDocumentRules,
  RulesApiError,
  deactivateDocumentGroup,
  toggleDocumentClass,
  toExtractionRule,
  updateDocumentGroup,
  updateDocumentClass,
  updateDocumentAccessMatrixCell,
  updateDocumentRule,
  type DocumentAccessPermissions,
} from '../api/rulesApi';
import {
  filterActiveCategories,
  filterActiveGroups,
  mapApiDocumentClass,
  mapApiGroup,
  mapCompanyMemberDtoToRulesMember,
} from '../api/mappers';
import { useCompanyMembers } from '@/features/users/hooks/useCompanyMembers';

export type InviteMemberInput = {
  name: string;
  email: string;
  position?: string;
  role: import('@/types/rules').UserRole;
  groupIds: string[];
  message?: string;
};

function handleApiError(error: unknown, fallback: string) {
  const message = error instanceof RulesApiError ? error.message : fallback;
  toast.error(message);
}

function enrichCategoriesFromMatrix(
  rawClasses: Awaited<ReturnType<typeof getDocumentClasses>>,
  matrix: Awaited<ReturnType<typeof getDocumentAccessMatrix>>,
) {
  return rawClasses.map((docClass) => {
    const permissions = {
      view: [] as string[],
      download: [] as string[],
      update: [] as string[],
      audit: [] as string[],
      share: [] as string[],
    };

    for (const rule of matrix.rules ?? []) {
      if (rule.categoryId !== docClass.id || !rule.active) continue;
      if (rule.permissions.view) permissions.view.push(rule.groupId);
      if (rule.permissions.download) permissions.download.push(rule.groupId);
      if (rule.permissions.upload) permissions.update.push(rule.groupId);
      if (rule.permissions.manage) permissions.audit.push(rule.groupId);
      if (rule.permissions.share) permissions.share.push(rule.groupId);
    }

    return mapApiDocumentClass({
      ...docClass,
      permissions,
    });
  });
}

export function useRules(actorName: string) {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.tenantId;
  const membersQuery = useCompanyMembers(tenantId ?? '');
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [rules, setRules] = useState<DocumentExtractionRule[]>([]);
  const [, setAuditEvents] = useState<AuditEvent[]>([]);
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
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [rawGroups, rawClasses, rawRules, matrix] = await Promise.all([
        getDocumentGroups(),
        getDocumentClasses(),
        getDocumentRules(),
        getDocumentAccessMatrix(),
      ]);

      setGroups(filterActiveGroups(rawGroups.map(mapApiGroup)));
      setCategories(filterActiveCategories(enrichCategoriesFromMatrix(rawClasses, matrix)));
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

  useEffect(() => {
    const nextMembers = membersQuery.data?.members;
    if (!nextMembers) return;
    setMembers(nextMembers.map(mapCompanyMemberDtoToRulesMember));
  }, [membersQuery.data?.members]);

  const groupMemberCounts = useMemo(
    () => computeGroupMemberCounts(groups, members),
    [groups, members],
  );

  const createGroup = useCallback(
    async (name: string, color: GroupColor) => {
      try {
        const created = await createDocumentGroup({ name, color });
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
        await deactivateDocumentGroup(groupId);
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            documentGroupIds: cat.documentGroupIds.filter((id) => id !== groupId),
            notifyGroupIds: cat.notifyGroupIds.filter((id) => id !== groupId),
            permissions: cat.permissions
              ? {
                  view: cat.permissions.view.filter((id) => id !== groupId),
                  download: cat.permissions.download.filter((id) => id !== groupId),
                  update: cat.permissions.update.filter((id) => id !== groupId),
                  audit: cat.permissions.audit.filter((id) => id !== groupId),
                  share: cat.permissions.share.filter((id) => id !== groupId),
                }
              : undefined,
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

  const updateGroup = useCallback(
    async (groupId: string, input: { name: string; description?: string }) => {
      try {
        const updated = await updateDocumentGroup(groupId, {
          name: input.name,
          description: input.description ?? null,
        });
        const mapped = mapApiGroup(updated);
        setGroups((prev) => prev.map((group) => (group.id === groupId ? mapped : group)));
        toast.success('Grupo atualizado.');
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar o grupo.');
      }
    },
    [],
  );

  const updateGroupClassPermissions = useCallback(
    async (groupId: string, classId: string, permissions: DocumentAccessPermissions) => {
      try {
        await updateDocumentAccessMatrixCell({ groupId, classId, permissions });
        const [refreshed, matrix] = await Promise.all([
          getDocumentClasses(),
          getDocumentAccessMatrix(),
        ]);
        setCategories(filterActiveCategories(enrichCategoriesFromMatrix(refreshed, matrix)));
        await invalidateLibraryQueries(queryClient, tenantId);
        toast.success('Permissões atualizadas.');
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar permissões.');
      }
    },
    [queryClient, tenantId],
  );

  const updateCategory = useCallback(
    async (categoryId: string, input: { name?: string; description?: string }) => {
      try {
        await updateDocumentClass(categoryId, input);
        const [rawClasses, matrix] = await Promise.all([
          getDocumentClasses(),
          getDocumentAccessMatrix(),
        ]);
        setCategories(filterActiveCategories(enrichCategoriesFromMatrix(rawClasses, matrix)));
        toast.success('Categoria atualizada.');
      } catch (err) {
        handleApiError(err, 'Não foi possível atualizar a categoria.');
      }
    },
    [],
  );

  const createCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      try {
        const created = await createDocumentClass({ name: trimmed });
        const mapped = mapApiDocumentClass(created);
        setCategories((prev) => [...prev, mapped]);
        const refreshedRules = await getDocumentRules();
        setRules(refreshedRules.map(toExtractionRule));
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
        expiryAlerts?: ExpiryAlertConfig;
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
            expiryAlerts: payload.expiryAlerts,
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
            expiryAlerts: payload.expiryAlerts,
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
    groupMemberCounts,
    loading,
    error,
    reload,
    createGroup,
    deleteGroup,
    updateGroup,
    updateGroupClassPermissions,
    updateCategory,
    createCategory,
    deleteCategory,
    saveExtractionRule,
    getRuleForClass,
  };
}
