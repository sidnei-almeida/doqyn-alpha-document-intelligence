import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/useAuth';
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

  const isAdmin =
    hasAnyRole(['doqyn_admin', 'company_admin', 'individual_admin']) || user?.role === 'admin';

  const {
    groups,
    categories,
    members,
    pendingApprovals,
    auditEvents,
    groupMemberCounts,
    loading,
    error,
    reload,
    createGroup,
    deleteGroup,
    updateGroup,
    updateCategory,
    addMemberToDocumentGroup,
    removeMemberFromDocumentGroup,
    updateGroupClassPermissions,
    createCategory,
    deleteCategory,
    approveMember,
    rejectMember,
    saveExtractionRule,
    getRuleForClass,
  } = useRules(user?.name ?? 'Usuário');

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-doqyn-muted">Carregando governança documental…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Governança"
          title="Regras de acesso"
          description="Mapa visual de categorias, grupos e permissões documentais."
        />
        <EmptyState
          title="Não foi possível carregar as regras agora."
          description="Verifique sua conexão e tente novamente."
          action={
            <Button type="button" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-auto w-full space-y-6">
      <PageHeader
        eyebrow="Governança"
        title="Mapa de regras"
        description="Categorias documentais, grupos de acesso e conexões persistidas no MongoDB do app."
      />

      <GovernanceMapCanvas
        categories={categories}
        groups={groups}
        members={members}
        pendingApprovals={pendingApprovals}
        auditEvents={auditEvents}
        groupMemberCounts={groupMemberCounts}
        isAdmin={isAdmin}
        onCreateCategory={() => setCategoryModalOpen(true)}
        onCreateGroup={() => setGroupModalOpen(true)}
        onApprove={approveMember}
        onReject={rejectMember}
        onAddMemberToGroup={addMemberToDocumentGroup}
        onRemoveMemberFromGroup={removeMemberFromDocumentGroup}
        onPermissionChange={updateGroupClassPermissions}
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
    </div>
  );
}
