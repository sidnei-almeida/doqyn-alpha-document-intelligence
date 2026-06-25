import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { useConfirm } from '@/components/confirm/ConfirmProvider';
import { buildRemoveFromGroupConfirm } from '@/components/confirm/confirmMessages';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/Tabs';
import type { AuditEvent, CompanyMember, DocumentCategory, Group, PendingApproval } from '@/types/rules';
import {
  AVAILABLE_DROP_ID,
  type MemberDragData,
  parseGroupDropId,
} from '../dnd/types';
import { AccessSummaryPanel } from './AccessSummaryPanel';
import { AuditPreview } from './AuditPreview';
import { AvailableUsersColumn, GroupColumn } from './GroupColumn';
import { PendingApprovalsPanel } from './PendingApprovalsPanel';
import { UserCardOverlay } from './UserCard';

interface MemberBoardProps {
  groups: Group[];
  categories: DocumentCategory[];
  members: CompanyMember[];
  pendingApprovals: PendingApproval[];
  auditEvents: AuditEvent[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAddMemberToGroup: (memberId: string, groupId: string) => void;
  onRemoveMemberFromGroup: (memberId: string, groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export function MemberBoard({
  groups,
  categories,
  members,
  pendingApprovals,
  auditEvents,
  groupMemberCounts,
  isAdmin,
  onApprove,
  onReject,
  onAddMemberToGroup,
  onRemoveMemberFromGroup,
  onDeleteGroup,
}: MemberBoardProps) {
  const confirm = useConfirm();
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>();
  const [activeMember, setActiveMember] = useState<CompanyMember | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as MemberDragData | undefined;
    if (data?.type === 'member') {
      const member = members.find((m) => m.id === data.memberId);
      if (member) setActiveMember(member);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveMember(null);

    const { active, over } = event;
    if (!over || !isAdmin) return;

    const data = active.data.current as MemberDragData | undefined;
    if (data?.type !== 'member') return;

    const member = members.find((m) => m.id === data.memberId);
    if (!member) return;

    if (member.status === 'pending' || member.status === 'blocked') {
      toast.error('Este usuário precisa ser aprovado antes de receber permissões.');
      return;
    }

    const overId = String(over.id);

    if (overId === AVAILABLE_DROP_ID) {
      if (data.sourceGroupId) {
        const sourceGroup = groups.find((g) => g.id === data.sourceGroupId);
        const ok = await confirm(
          buildRemoveFromGroupConfirm(member.name, sourceGroup?.name ?? 'grupo'),
        );
        if (ok) onRemoveMemberFromGroup(member.id, data.sourceGroupId);
      }
      return;
    }

    const targetGroupId = parseGroupDropId(overId);
    if (targetGroupId) {
      if (member.groupIds.includes(targetGroupId)) return;
      onAddMemberToGroup(member.id, targetGroupId);
    }
  };

  return (
    <div className="space-y-6">
      <PendingApprovalsPanel
        items={pendingApprovals}
        isAdmin={isAdmin}
        onApprove={onApprove}
        onReject={onReject}
      />

      <section>
        <SectionHeader
          title="Organização por grupos"
          description={
            isAdmin
              ? 'Arraste membros entre colunas para definir permissões. Clique em um membro para ver o resumo abaixo.'
              : 'Visualize a distribuição de membros por grupo. Clique em um membro para ver o resumo de acesso.'
          }
        />
        <Card className="overflow-hidden border-doqyn-border bg-doqyn-surface">
          <CardContent className="p-0">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={(e) => void handleDragEnd(e)}
            >
              <div className="overflow-x-auto p-4 scrollbar-thin">
                <div className="flex min-w-max gap-3">
                  <AvailableUsersColumn
                    members={members}
                    groups={groups}
                    selectedMemberId={selectedMemberId}
                    isAdmin={isAdmin}
                    onSelectMember={(m) => setSelectedMemberId(m.id)}
                  />
                  {groups.map((group) => (
                    <GroupColumn
                      key={group.id}
                      group={group}
                      members={members}
                      allGroups={groups}
                      memberCount={groupMemberCounts[group.id] ?? 0}
                      selectedMemberId={selectedMemberId}
                      isAdmin={isAdmin}
                      onSelectMember={(m) => setSelectedMemberId(m.id)}
                      onRemoveMember={(memberId) => onRemoveMemberFromGroup(memberId, group.id)}
                      onDeleteGroup={onDeleteGroup}
                    />
                  ))}
                </div>
              </div>

              <DragOverlay dropAnimation={null}>
                {activeMember ? <UserCardOverlay member={activeMember} /> : null}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Resumo do membro"
          description={
            selectedMember
              ? `Detalhes de acesso de ${selectedMember.name}`
              : 'Selecione um membro no quadro acima'
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          <AccessSummaryPanel member={selectedMember} groups={groups} categories={categories} />
          <AuditPreview events={auditEvents} />
        </div>
      </section>
    </div>
  );
}
