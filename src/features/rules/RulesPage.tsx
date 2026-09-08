import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/features/auth/useAuth';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { isIndividualTenant } from '@/lib/tenantVocabulary';
import { AccessMatrixView } from './components/access/AccessMatrixView';
import { AccessBoard } from './components/board/AccessBoard';
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
import { useTranslation } from 'react-i18next';

type RulesTab = 'acessos' | 'matriz';

/**
 * A Biblioteca chama de pasta o que a governança chama de categoria: são a
 * mesma coisa. Quem clica em "Nova categoria" lá chega aqui já com o formulário
 * aberto, em vez de aterrissar na página e ter de procurar o botão.
 */
const NEW_CATEGORY_PARAM = 'nova';

export function RulesPage() {
  const { t } = useTranslation('rules');

  const { user, hasAnyRole, tenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<RulesTab>('acessos');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [extractionCategory, setExtractionCategory] = useState<DocumentCategory | null>(null);
  const [detailSelection, setDetailSelection] = useState<GovernanceEntitySelection | null>(null);
  const [simulatedMemberId, setSimulatedMemberId] = useState('');

  const isAdmin = canAccessRulesPage(hasAnyRole) || user?.role === 'admin';
  /**
   * Grupos só existem onde há mais de uma pessoa. Em PF o pool individual é filtrado por
   * `ownerUserId` (`server/tenancy/documentOwnership.ts`), então não há entre quem repartir:
   * o trilho, o placar de cobertura, o "Ver como" e a Matriz saem da tela. Categoria e regra
   * de extração ficam — é o que PF de fato configura.
   */
  const showGroups = !isIndividualTenant(tenant?.tenantType);

  useEffect(() => {
    if (!isAdmin || searchParams.get(NEW_CATEGORY_PARAM) !== 'categoria') return;
    setCategoryModalOpen(true);
    // O parâmetro é gatilho, não estado: sai da URL para que um refresh não
    // reabra o formulário sozinho.
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete(NEW_CATEGORY_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [isAdmin, searchParams, setSearchParams]);

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
        <p className="text-sm text-doqyn-muted">{t('rulesPage.carregandoGovernancaDocumental')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <PageShell
        eyebrow="Governança"
        title={t('rulesPage.regrasDeAcesso')}
        description={
          showGroups
            ? 'Conecte grupos de pessoas às categorias de documentos.'
            : 'Categorias e o que a IA extrai de cada uma.'
        }
      >
        <EmptyState
          stretch
          title={t('rulesPage.naoFoiPossivelCarregar')}
          description={t('rulesPage.verifiqueSuaConexaoE')}
          action={
            <Button type="button" onClick={() => void reload()}>
              {t('rulesPage.tentarNovamente')}
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Governança"
      title={t('rulesPage.regrasDeAcesso2')}
      description={
        showGroups
          ? 'Quem não está num grupo conectado não vê os documentos da categoria.'
          : 'Categorias e o que a IA extrai de cada uma.'
      }
      actions={
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            {showGroups ? (
              <>
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
                  {t('rulesPage.novoGrupo')}
                </Button>
              </>
            ) : null}
            <Button type="button" size="sm" onClick={() => setCategoryModalOpen(true)}>
              {t('rulesPage.novaCategoria')}
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

      {/* A Matriz é categorias × grupos: sem grupos ela não tem segunda dimensão, e uma aba
          sozinha não é escolha. */}
      {showGroups ? (
        <Tabs
          tabs={[
            { id: 'acessos', label: 'Acessos' },
            { id: 'matriz', label: 'Matriz' },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as RulesTab)}
          className="-mt-2"
        />
      ) : null}

      {(activeTab === 'acessos' || !showGroups) &&
        (categories.length === 0 ? (
          <EmptyState
            stretch
            title={t('rulesPage.nenhumaCategoriaDeDocumentos')}
            description={
              showGroups
                ? 'Crie uma categoria para começar a organizar o acesso por grupos.'
                : 'Crie uma categoria para dizer à IA o que extrair de cada documento.'
            }
            action={
              isAdmin ? (
                <Button type="button" onClick={() => setCategoryModalOpen(true)}>
                  {t('rulesPage.novaCategoria2')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <AccessBoard
            categories={categories}
            groups={groups}
            groupMemberCounts={groupMemberCounts}
            members={members}
            isAdmin={isAdmin}
            showGroups={showGroups}
            simulatedMember={simulatedMember}
            onPermissionChange={updateGroupClassPermissions}
            onOpenCategoryDetails={(categoryId) =>
              setDetailSelection({ type: 'category', id: categoryId })
            }
            onOpenGroupDetails={(groupId) => setDetailSelection({ type: 'group', id: groupId })}
            onConfigureExtraction={isAdmin ? (target) => setExtractionCategory(target) : undefined}
            onCreateGroup={isAdmin ? () => setGroupModalOpen(true) : undefined}
          />
        ))}

      {activeTab === 'matriz' && showGroups && (
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
            groups={groups}
          />
        </>
      )}
    </PageShell>
  );
}
