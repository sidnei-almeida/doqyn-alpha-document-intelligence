import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { CategoryModal } from './components/CategoryModal';
import { ExtractionConfigDrawer } from './components/ExtractionConfigDrawer';
import { GovernanceMapCanvas } from './components/governance/GovernanceMapCanvas';
import { GroupModal } from './components/GroupModal';
import { useRules } from './hooks/useRules';
import type { DocumentCategory } from '@/types/rules';

export function RulesPage() {
  const { user, hasAnyRole } = useAuth();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [extractionCategory, setExtractionCategory] = useState<DocumentCategory | null>(null);

  const isAdmin = canAccessRulesPage(hasAnyRole) || user?.role === 'admin';

  const {
    groups,
    categories,
    groupMemberCounts,
    loading,
    error,
    reload,
    createGroup,
    deleteGroup,
    updateGroup,
    updateCategory,
    updateGroupClassPermissions,
    saveGovernanceMapChanges,
    createCategory,
    deleteCategory,
    saveExtractionRule,
    getRuleForClass,
  } = useRules(user?.name ?? 'Usuário');

  const extractionConfiguredCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const category of categories) {
      if (getRuleForClass(category.id)) ids.add(category.id);
    }
    return ids;
  }, [categories, getRuleForClass]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-doqyn-muted">Carregando governança documental…</p>
      </div>
    );
  }

  if (error) {
    return (
      <PageShell
        eyebrow="Governança"
        title="Regras de acesso"
        description="Mapa visual de categorias, grupos documentais e permissões."
      >
        <EmptyState
          stretch
          title="Não foi possível carregar as regras agora."
          description="Verifique sua conexão e tente novamente."
          action={
            <Button type="button" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Governança"
      title="Mapa de regras"
      description="Categorias documentais, grupos e conexões de acesso. Membros dos grupos são gerenciados em Usuários."
      bodyClassName="min-h-0"
    >
      <GovernanceMapCanvas
        className="min-h-0 flex-1"
        categories={categories}
        groups={groups}
        groupMemberCounts={groupMemberCounts}
        isAdmin={isAdmin}
        onCreateCategory={() => setCategoryModalOpen(true)}
        onCreateGroup={() => setGroupModalOpen(true)}
        onPermissionChange={updateGroupClassPermissions}
        onSaveMapChanges={saveGovernanceMapChanges}
        onSaveCategory={async (categoryId, input) => {
          await updateCategory(categoryId, input);
        }}
        onSaveGroup={updateGroup}
        onDeleteCategory={isAdmin ? deleteCategory : undefined}
        onDeactivateGroup={
          isAdmin
            ? async (groupId) => {
                await deleteGroup(groupId);
              }
            : undefined
        }
        onConfigureExtraction={isAdmin ? (category) => setExtractionCategory(category) : undefined}
        extractionConfiguredCategoryIds={extractionConfiguredCategoryIds}
      />

      {isAdmin && (
        <>
          <GroupModal
            open={groupModalOpen}
            onClose={() => setGroupModalOpen(false)}
            onCreate={createGroup}
          />
          <CategoryModal
            open={categoryModalOpen}
            onClose={() => setCategoryModalOpen(false)}
            onCreate={createCategory}
          />
          <ExtractionConfigDrawer
            open={extractionCategory !== null}
            category={extractionCategory}
            rule={extractionCategory ? getRuleForClass(extractionCategory.id) : null}
            onClose={() => setExtractionCategory(null)}
            onSave={saveExtractionRule}
          />
        </>
      )}
    </PageShell>
  );
}
