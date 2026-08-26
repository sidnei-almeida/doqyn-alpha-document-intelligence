import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/Button';
import { groupColorVar } from '@/utils/rulesHelpers';
import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import {
  countPeopleWhoSee,
  getCategoryGroupPermissions,
  hasAnyPermission,
  simulateMemberAccess,
} from '../access/accessModel';
import type { PermissionVerb } from '../access/PermissionVerbs';
import { CategoryLane } from './CategoryLane';
import { GovernanceScoreboard } from './GovernanceScoreboard';
import { computeCategoryReach, computeGovernanceProgress } from './governanceProgress';
import { GroupToken } from './GroupToken';
import { toPermissionState, type GovernancePermissionState } from '@shared/governancePermissions';

const VIEW_ONLY: DocumentAccessPermissions = { ...EMPTY_CONNECTION_PERMISSIONS, view: true };

type PendingUndo = {
  label: string;
  categoryId: string;
  groupId: string;
  previous: DocumentAccessPermissions;
};

export type AccessBoardProps = {
  categories: DocumentCategory[];
  groups: Group[];
  groupMemberCounts: Record<string, number>;
  /** Todas as pessoas da empresa — é o denominador da cobertura. */
  members: CompanyMember[];
  isAdmin: boolean;
  simulatedMember: CompanyMember | null;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
  onOpenCategoryDetails: (categoryId: string) => void;
  onOpenGroupDetails: (groupId: string) => void;
  onConfigureExtraction?: (category: DocumentCategory) => void;
  onCreateGroup?: () => void;
};

/**
 * Quadro de acesso: a coluna de grupos à esquerda, uma faixa por categoria à direita.
 *
 * A tela anterior mostrava o resultado da configuração e escondia a configuração em dois cliques
 * (dropdown "adicionar grupo", depois popover). Aqui conceder é levar a ficha até a faixa, e o
 * cabeçalho da faixa responde antes de soltar: mostra para quanto o número de pessoas vai.
 */
/** O quadro diz o efeito, não o campo: o aviso precisa nomear o meio-termo. */
const VERB_LABEL: Record<PermissionVerb, string> = {
  view: 'ver',
  download: 'baixar',
  upload: 'enviar',
};

const STATE_LABEL: Record<GovernancePermissionState, string> = {
  deny: 'desligado',
  allow: 'liberado',
  require: 'passa a pedir aprovação',
};

export function AccessBoard({
  categories,
  groups,
  groupMemberCounts,
  members,
  isAdmin,
  simulatedMember,
  onPermissionChange,
  onOpenCategoryDetails,
  onOpenGroupDetails,
  onConfigureExtraction,
  onCreateGroup,
}: AccessBoardProps) {
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [hoverCategoryId, setHoverCategoryId] = useState<string | null>(null);
  const [undo, setUndo] = useState<PendingUndo | null>(null);
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const memberCountOf = (group: Group) => groupMemberCounts[group.id] ?? group.memberCount ?? 0;
  const draggingGroup = groups.find((group) => group.id === draggingGroupId) ?? null;

  const peopleByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const category of categories) {
      map.set(category.id, countPeopleWhoSee(category, groups, groupMemberCounts));
    }
    return map;
  }, [categories, groups, groupMemberCounts]);

  const progress = useMemo(
    () => computeGovernanceProgress(categories, groups, members),
    [categories, groups, members],
  );

  /** Placar do que aconteceria se a ficha na mão pousasse nesta faixa. */
  function previewFor(category: DocumentCategory): number | null {
    if (!draggingGroup || hoverCategoryId !== category.id) return null;
    const current = getCategoryGroupPermissions(category, draggingGroup.id);
    if (current.view || current.download) return null;
    return (peopleByCategory.get(category.id) ?? 0) + memberCountOf(draggingGroup);
  }

  async function applyPermissions(
    category: DocumentCategory,
    group: Group,
    next: DocumentAccessPermissions,
    label: string,
  ) {
    const previous = getCategoryGroupPermissions(category, group.id);
    await onPermissionChange(group.id, category.id, next);
    setUndo({ label, categoryId: category.id, groupId: group.id, previous });
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingGroupId((event.active.data.current?.groupId as string) ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const categoryId = event.over?.data.current?.categoryId as string | undefined;
    setHoverCategoryId(categoryId ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const groupId = event.active.data.current?.groupId as string | undefined;
    const fromCategoryId = event.active.data.current?.fromCategoryId as string | null | undefined;
    const toCategoryId = event.over?.data.current?.categoryId as string | undefined;

    setDraggingGroupId(null);
    setHoverCategoryId(null);

    if (!groupId) return;
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;

    // Soltou fora de qualquer faixa, vindo de uma: é remoção.
    if (!toCategoryId && fromCategoryId) {
      const category = categories.find((item) => item.id === fromCategoryId);
      if (!category) return;
      await applyPermissions(
        category,
        group,
        EMPTY_CONNECTION_PERMISSIONS,
        `${group.name} saiu de ${category.name}.`,
      );
      return;
    }

    if (!toCategoryId || toCategoryId === fromCategoryId) return;

    const category = categories.find((item) => item.id === toCategoryId);
    if (!category) return;
    if (hasAnyPermission(getCategoryGroupPermissions(category, group.id))) return;

    // A consequência é o que dá sentido ao gesto: quem soltou o grupo quer saber quantas
    // pessoas passaram a ver, não só que a regra foi gravada.
    const gained = memberCountOf(group);
    await applyPermissions(
      category,
      group,
      VIEW_ONLY,
      gained > 0
        ? `${group.name} alcança ${category.name} — mais ${gained} ${gained === 1 ? 'pessoa vê' : 'pessoas veem'}.`
        : `${group.name} alcança ${category.name} — o grupo ainda não tem pessoas.`,
    );
  }

  const focusedCategory = categories.find((item) => item.id === focusedCategoryId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => {
        setDraggingGroupId(null);
        setHoverCategoryId(null);
      }}
    >
      <GovernanceScoreboard progress={progress} isAdmin={isAdmin} onCreateGroup={onCreateGroup} />

      <div className="access-board">
        <aside className="access-board__rail" aria-label="Grupos da empresa">
          <p className="register-label text-doqyn-subtle">Grupos</p>
          <p className="type-caption text-doqyn-subtle">
            {focusedCategory
              ? `Quem ainda não alcança ${focusedCategory.name} aparece aceso.`
              : 'Arraste um grupo para a categoria que ele deve alcançar.'}
          </p>
          <div className="access-board__rail-list">
            {groups.map((group) => {
              const missing = focusedCategory
                ? !hasAnyPermission(getCategoryGroupPermissions(focusedCategory, group.id))
                : false;
              return (
                <div key={group.id} data-missing={missing} className="access-board__rail-item">
                  <GroupToken
                    group={group}
                    memberCount={memberCountOf(group)}
                    disabled={!isAdmin}
                    onOpenGroupDetails={() => onOpenGroupDetails(group.id)}
                  />
                </div>
              );
            })}
          </div>
        </aside>

        <div className="access-board__lanes">
          {categories.map((category) => {
            const connected = groups.filter((group) =>
              hasAnyPermission(getCategoryGroupPermissions(category, group.id)),
            );
            return (
              <div
                key={category.id}
                onMouseEnter={() => setFocusedCategoryId(category.id)}
                onMouseLeave={() => setFocusedCategoryId(null)}
                onFocus={() => setFocusedCategoryId(category.id)}
                onBlur={() => setFocusedCategoryId(null)}
              >
                <CategoryLane
                  category={category}
                  peopleCount={peopleByCategory.get(category.id) ?? 0}
                  previewCount={previewFor(category)}
                  reach={computeCategoryReach(
                    category,
                    groups,
                    peopleByCategory.get(category.id) ?? 0,
                    progress.totalPeople,
                  )}
                  simulation={
                    simulatedMember ? simulateMemberAccess(simulatedMember, category, groups) : null
                  }
                  isAdmin={isAdmin}
                  onOpenDetails={() => onOpenCategoryDetails(category.id)}
                  onConfigureExtraction={
                    isAdmin && onConfigureExtraction
                      ? () => onConfigureExtraction(category)
                      : undefined
                  }
                  emptyLabel={
                    connected.length === 0
                      ? 'Ninguém alcança esta categoria — só administradores.'
                      : ''
                  }
                >
                  {connected.map((group) => {
                    const permissions = getCategoryGroupPermissions(category, group.id);
                    return (
                      <GroupToken
                        key={group.id}
                        group={group}
                        memberCount={memberCountOf(group)}
                        category={category}
                        permissions={permissions}
                        disabled={!isAdmin}
                        onToggleVerb={(verb: PermissionVerb, next) =>
                          void applyPermissions(
                            category,
                            group,
                            { ...permissions, [verb]: next },
                            `${group.name}: ${VERB_LABEL[verb]} ${STATE_LABEL[toPermissionState(next)]}.`,
                          )
                        }
                        onChangePermissions={async (next) => {
                          await applyPermissions(
                            category,
                            group,
                            next,
                            `${group.name} atualizado.`,
                          );
                        }}
                        onRemove={async () => {
                          await applyPermissions(
                            category,
                            group,
                            EMPTY_CONNECTION_PERMISSIONS,
                            `${group.name} saiu de ${category.name}.`,
                          );
                        }}
                        onOpenGroupDetails={() => onOpenGroupDetails(group.id)}
                      />
                    );
                  })}
                </CategoryLane>
              </div>
            );
          })}
        </div>
      </div>

      {undo ? (
        <div className="access-board__undo" role="status">
          <p className="type-body text-doqyn-text">{undo.label}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const target = undo;
              setUndo(null);
              void onPermissionChange(target.groupId, target.categoryId, target.previous);
            }}
          >
            Desfazer
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setUndo(null)}>
            Dispensar
          </Button>
        </div>
      ) : null}

      <DragOverlay dropAnimation={null}>
        {draggingGroup ? (
          <div
            className="group-token group-token--overlay"
            style={{ '--swatch': groupColorVar(draggingGroup.color) } as React.CSSProperties}
          >
            <span className="group-token__grip">
              <span className="group-dot" aria-hidden />
              <span className="group-token__name">{draggingGroup.name}</span>
              <span className="group-token__count">{memberCountOf(draggingGroup)}</span>
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
