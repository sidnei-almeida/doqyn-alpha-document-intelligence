import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs, SectionHeader } from '@/components/ui/Tabs';
import { useAuth } from '@/features/auth/useAuth';
import { CategoryAccessBoard } from './components/CategoryAccessBoard';
import { CategoryModal } from './components/CategoryModal';
import { ExtractionConfigDrawer } from './components/ExtractionConfigDrawer';
import { GroupModal } from './components/GroupModal';
import { InviteMemberModal } from './components/InviteMemberModal';
import { MemberBoard } from './components/MemberBoard';
import { useRules } from './hooks/useRules';
import type { DocumentCategory } from '@/types/rules';

type RulesTab = 'categories' | 'members';

export function RulesPage() {
  const { user, hasAnyRole } = useAuth();
  const [activeTab, setActiveTab] = useState<RulesTab>('categories');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [extractionCategory, setExtractionCategory] = useState<DocumentCategory | null>(null);

  const isAdmin =
    hasAnyRole(['doqyn_admin', 'company_admin']) || user?.role === 'admin';

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
    saveExtractionRule,
    getRuleForClass,
  } = useRules(user?.name ?? 'Usuário');

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-doqyn-muted">Carregando regras…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Governança"
          title="Regras de acesso"
          description="Organize membros, grupos e categorias."
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
        title="Regras de acesso"
        description="Organize membros, grupos e categorias. Arraste usuários para grupos e grupos para categorias."
        actions={
          isAdmin ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Convidar membro
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCategoryModalOpen(true)}>
                Nova categoria
              </Button>
              <Button type="button" onClick={() => setGroupModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Novo grupo
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="min-w-0 space-y-4">
        <Tabs
          tabs={[
            { id: 'categories', label: 'Categorias' },
            { id: 'members', label: 'Membros', badge: pendingApprovals.length },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as RulesTab)}
        />

        {activeTab === 'categories' ? (
          <SectionHeader
            className="mt-2"
            title="Acesso por categoria"
            description="Defina quais grupos podem acessar cada tipo de documento da empresa."
          />
        ) : (
          <SectionHeader
            className="mt-2"
            title="Membros e grupos"
            description="Distribua usuários nos grupos para controlar permissões de forma visual."
          />
        )}

        {activeTab === 'categories' ? (
          <CategoryAccessBoard
            categories={categories}
            groups={groups}
            groupMemberCounts={groupMemberCounts}
            isAdmin={isAdmin}
            onAssign={assignGroupToCategory}
            onRemove={removeGroupFromCategory}
            onToggleNotifications={toggleAllNotifications}
            onDelete={isAdmin ? deleteCategory : undefined}
            onDeleteGroup={isAdmin ? deleteGroup : undefined}
            onConfigureExtraction={isAdmin ? (cat) => setExtractionCategory(cat) : undefined}
          />
        ) : (
          <MemberBoard
            groups={groups}
            categories={categories}
            members={members}
            pendingApprovals={pendingApprovals}
            auditEvents={auditEvents}
            groupMemberCounts={groupMemberCounts}
            isAdmin={isAdmin}
            onApprove={approveMember}
            onReject={rejectMember}
            onAddMemberToGroup={addMemberToGroup}
            onRemoveMemberFromGroup={removeMemberFromGroup}
            onDeleteGroup={isAdmin ? deleteGroup : undefined}
          />
        )}
      </div>

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
          <InviteMemberModal
            open={inviteModalOpen}
            groups={groups}
            onClose={() => setInviteModalOpen(false)}
            onInvite={inviteMember}
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
