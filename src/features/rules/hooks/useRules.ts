import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import { invalidateLibraryQueries } from '@/features/library/utils/libraryQueryInvalidation';
import type {
  CompanyMember,
  DocumentCategory,
  DocumentExtractionRule,
  ExpiryAlertConfig,
  Group,
  GroupColor,
} from '@/types/rules';
import { computeGroupMemberCounts } from '@/utils/rulesHelpers';
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
import { toPermissionState, type GovernancePermissionValue } from '@shared/governancePermissions';
import {
  filterActiveCategories,
  filterActiveGroups,
  mapApiDocumentClass,
  mapApiGroup,
  mapCompanyMemberDtoToRulesMember,
} from '../api/mappers';
import { useCompanyMembers } from '@/features/users/hooks/useCompanyMembers';
import { i18n } from '@/i18n';

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

    const permissionStates: NonNullable<DocumentCategory['permissionStates']> = {};

    const record = (
      verb: 'view' | 'download' | 'update' | 'audit' | 'share',
      groupId: string,
      value: GovernancePermissionValue,
    ) => {
      const state = toPermissionState(value);
      if (state === 'deny') return;
      // Quem precisa pedir também alcança a categoria: entra na lista e é marcado ao lado.
      permissions[verb].push(groupId);
      if (state === 'require') {
        permissionStates[verb] = { ...(permissionStates[verb] ?? {}), [groupId]: 'require' };
      }
    };

    for (const rule of matrix.rules ?? []) {
      if (rule.categoryId !== docClass.id || !rule.active) continue;
      record('view', rule.groupId, rule.permissions.view);
      record('download', rule.groupId, rule.permissions.download);
      record('update', rule.groupId, rule.permissions.upload);
      record('audit', rule.groupId, rule.permissions.manage);
      record('share', rule.groupId, rule.permissions.share);
    }

    return {
      ...mapApiDocumentClass({ ...docClass, permissions }),
      permissionStates,
    };
  });
}

export function useRules() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.tenantId;
  const membersQuery = useCompanyMembers(tenantId ?? '');
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [rules, setRules] = useState<DocumentExtractionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(i18n.t('rules:rulesPage.naoFoiPossivelCarregar'));
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

  const createGroup = useCallback(async (name: string, color: GroupColor) => {
    try {
      const created = await createDocumentGroup({ name, color });
      const mapped = mapApiGroup(created);
      setGroups((prev) => [...prev, mapped]);
      toast.success(i18n.t('rules:toast.grupoCriado'));
    } catch (err) {
      handleApiError(err, i18n.t('rules:toastError.createGroup'));
    }
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
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
      toast.success(i18n.t('rules:toast.grupoDesativado'));
    } catch (err) {
      handleApiError(err, i18n.t('rules:toastError.deactivateGroup'));
    }
  }, []);

  const updateGroup = useCallback(
    async (groupId: string, input: { name: string; description?: string; color?: string }) => {
      try {
        const updated = await updateDocumentGroup(groupId, {
          name: input.name,
          description: input.description ?? null,
          color: input.color,
        });
        const mapped = mapApiGroup(updated);
        setGroups((prev) => prev.map((group) => (group.id === groupId ? mapped : group)));
        toast.success(i18n.t('rules:toast.grupoAtualizado'));
      } catch (err) {
        handleApiError(err, i18n.t('rules:toastError.updateGroup'));
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
        toast.success(i18n.t('rules:toast.permissoesAtualizadas'));
      } catch (err) {
        handleApiError(err, i18n.t('rules:toastError.updatePermissions'));
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
        toast.success(i18n.t('rules:toast.categoriaAtualizada'));
      } catch (err) {
        handleApiError(err, i18n.t('rules:toastError.updateCategory'));
      }
    },
    [],
  );

  const createCategory = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await createDocumentClass({ name: trimmed });
      const mapped = mapApiDocumentClass(created);
      setCategories((prev) => [...prev, mapped]);
      const refreshedRules = await getDocumentRules();
      setRules(refreshedRules.map(toExtractionRule));
      toast.success(i18n.t('rules:toast.categoriaCriada'));
    } catch (err) {
      handleApiError(err, i18n.t('rules:toastError.createCategory'));
    }
  }, []);

  const deleteCategory = useCallback(async (categoryId: string) => {
    try {
      await toggleDocumentClass(categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      toast.success(i18n.t('rules:toast.categoriaDesativada'));
    } catch (err) {
      handleApiError(err, i18n.t('rules:toastError.deactivateCategory'));
    }
  }, []);

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

        toast.success(i18n.t('rules:toast.configuracaoSalva'));
        return savedRule;
      } catch (err) {
        handleApiError(err, i18n.t('rules:toastError.saveConfig'));
        return null;
      }
    },
    [rules],
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
