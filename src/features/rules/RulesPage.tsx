import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/features/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { AccessMatrixView } from './components/access/AccessMatrixView';
import { CategoryAccessCard } from './components/access/CategoryAccessCard';
import { simulateMemberAccess } from './components/access/accessModel';
import { SimulateAccessBanner, SimulateAccessSelect } from './components/access/SimulateAccessBar';
import { CategoryModal } from './components/CategoryModal';
import { ExtractionConfigDrawer } from './components/ExtractionConfigDrawer';
import {
  GovernanceDetailDialog,
  type GovernanceEntitySelection,
} from './components/governance/GovernanceDetailDialog';
import { GroupModal } from './components/GroupModal';
import { useRules } from './hooks/useRules';
import type { DocumentCategory } from '@/types/rules';

type RulesTab = 'acessos' | 'matriz';

export function RulesPage() {
  const { user, hasAnyRole } = useAuth();
  const [activeTab, setActiveTab] = useState<RulesTab>('acessos');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [extractionCategory, setExtractionCategory] = useState<DocumentCategory | null>(null);
  const [detailSelection, setDetailSelection] = useState<GovernanceEntitySelection | null>(null);
  const [simulatedMemberId, setSimulatedMemberId] = useState('');

  const isAdmin = canAccessRulesPage(hasAnyRole) || user?.role === 'admin';

  const {
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
    updateCategory,
    updateGroupClassPermissions,
    createCategory,
    deleteCategory,
    saveExtractionRule,
    getRuleForClass,
  } = useRules(user?.name ?? 'Usuário');

  const simulatedMember = useMemo(
    () => members.find((member) => member.id === simulatedMemberId) ?? null,
    [members, simulatedMemberId],
  );

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
        description="Conecte grupos de pessoas às categorias de documentos."
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
      title="Regras de acesso"
      description="Conecte grupos de pessoas às categorias de documentos. Quem não está em um grupo conectado não vê os documentos da categoria."
      actions={
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <SimulateAccessSelect
              members={members}
              activeMemberId={simulatedMemberId}
              onChange={setSimulatedMemberId}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setGroupModalOpen(true)}
            >
              Novo grupo
            </Button>
            <Button type="button" size="sm" onClick={() => setCategoryModalOpen(true)}>
              Nova categoria
            </Button>
          </div>
        ) : undefined
      }
    >
      {simulatedMember && (
        <SimulateAccessBanner
          member={simulatedMember}
          groups={groups}
          onExit={() => setSimulatedMemberId('')}
        />
      )}

      <Tabs
        tabs={[
          { id: 'acessos', label: 'Acessos' },
          { id: 'matriz', label: 'Matriz' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as RulesTab)}
        className="-mt-2"
      />

      {activeTab === 'acessos' &&
        (categories.length === 0 ? (
          <EmptyState
            stretch
            title="Nenhuma categoria de documentos ainda."
            description="Crie uma categoria para começar a organizar o acesso por grupos."
            action={
              isAdmin ? (
                <Button type="button" onClick={() => setCategoryModalOpen(true)}>
                  Nova categoria
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
            {categories.map((category) => (
              <CategoryAccessCard
                key={category.id}
                category={category}
                groups={groups}
                groupMemberCounts={groupMemberCounts}
                isAdmin={isAdmin}
                simulation={
                  simulatedMember ? simulateMemberAccess(simulatedMember, category, groups) : null
                }
                onPermissionChange={updateGroupClassPermissions}
                onOpenCategoryDetails={(categoryId) =>
                  setDetailSelection({ type: 'category', id: categoryId })
                }
                onOpenGroupDetails={(groupId) => setDetailSelection({ type: 'group', id: groupId })}
                onConfigureExtraction={
                  isAdmin ? (target) => setExtractionCategory(target) : undefined
                }
              />
            ))}
          </div>
        ))}

      {activeTab === 'matriz' && (
        <AccessMatrixView
          categories={categories}
          groups={groups}
          groupMemberCounts={groupMemberCounts}
          isAdmin={isAdmin}
          onPermissionChange={updateGroupClassPermissions}
        />
      )}

      <GovernanceDetailDialog
        open={detailSelection !== null}
        selection={detailSelection}
        categories={categories}
        groups={groups}
        groupMemberCounts={groupMemberCounts}
        isAdmin={isAdmin}
        onClose={() => setDetailSelection(null)}
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
        onPermissionChange={updateGroupClassPermissions}
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
