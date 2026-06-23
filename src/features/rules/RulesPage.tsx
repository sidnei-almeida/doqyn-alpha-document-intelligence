import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { CategoryAccessBoard } from './components/CategoryAccessBoard';
import { CategoryModal } from './components/CategoryModal';
import { GroupModal } from './components/GroupModal';
import { InviteMemberModal } from './components/InviteMemberModal';
import { MemberBoard } from './components/MemberBoard';
import { useRules } from './hooks/useRules';
import { CURRENT_USER_ROLE } from './mockData';

type RulesTab = 'categories' | 'members';

export function RulesPage() {
  const [activeTab, setActiveTab] = useState<RulesTab>('categories');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const isAdmin = CURRENT_USER_ROLE === 'admin';

  const {
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
  } = useRules();

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
        </>
      )}
    </div>
  );
}
