import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type {
  AuditEvent,
  CompanyMember,
  DocumentCategory,
  Group,
  PendingApproval,
} from '@/types/rules';
import { STATUS_LABELS } from '@/utils/rulesHelpers';
import { EditMemberGroupsModal } from './EditMemberGroupsModal';
import { GroupCard } from './GroupCard';
import { MemberDetailPanel } from './MemberDetailPanel';
import { MembersTable, type MemberGroupFilter, type MemberStatusFilter } from './MembersTable';
import { PendingApprovalsCard } from './PendingApprovalsCard';

interface MembersTabProps {
  groups: Group[];
  categories: DocumentCategory[];
  members: CompanyMember[];
  pendingApprovals: PendingApproval[];
  auditEvents: AuditEvent[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onAddGroup?: () => void;
  onDeleteGroup?: (groupId: string) => void;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  onUpdateMemberGroups: (memberId: string, groupIds: string[]) => void;
  onUpdateMemberRole: (memberId: string, role: CompanyMember['role']) => void;
  onSuspendMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}

export function MembersTab({
  groups,
  categories,
  members,
  pendingApprovals,
  auditEvents,
  groupMemberCounts,
  isAdmin,
  onAddGroup,
  onDeleteGroup,
  onApprove,
  onReject,
  onUpdateMemberGroups,
  onUpdateMemberRole,
  onSuspendMember,
  onRemoveMember,
}: MembersTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>('all');
  const [groupFilter, setGroupFilter] = useState<MemberGroupFilter>('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>('mbr_mariana');
  const [editGroupsMember, setEditGroupsMember] = useState<CompanyMember | null>(null);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      if (statusFilter !== 'all' && member.status !== statusFilter) return false;
      if (groupFilter !== 'all' && !member.groupIds.includes(groupFilter)) return false;
      if (!query) return true;

      return (
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        (member.position?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [members, search, statusFilter, groupFilter]);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  const handleApproveFromTable = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const approval = pendingApprovals.find((p) => p.email === member.email);
    if (approval) {
      onApprove(approval.id);
    }
  };

  const handleRejectFromTable = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const approval = pendingApprovals.find((p) => p.email === member.email);
    if (approval) {
      onReject(approval.id);
    } else {
      onRemoveMember(memberId);
    }
  };

  return (
    <div className="space-y-4">
      <PendingApprovalsCard
        items={pendingApprovals}
        isAdmin={isAdmin}
        onApprove={onApprove}
        onReject={onReject}
      />

      <div className="grid items-start gap-4 min-[1280px]:grid-cols-[220px_1fr_280px]">
        <Card className="border-doqyn-border bg-doqyn-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Grupos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                memberCount={groupMemberCounts[group.id] ?? 0}
                draggable={false}
                isAdmin={isAdmin}
                onDelete={onDeleteGroup}
              />
            ))}
            {isAdmin && onAddGroup && (
              <button
                type="button"
                onClick={onAddGroup}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-doqyn-border py-2.5 text-sm text-doqyn-muted transition-colors hover:border-doqyn-primary/40 hover:text-doqyn-text"
              >
                <Icon name="add" size={ICON_SIZE.xs} />
                Adicionar grupo
              </button>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-doqyn-text">Membros da empresa</h3>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              O acesso a documentos é definido pelos grupos de cada membro.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[180px] flex-1">
              <Input
                id="member-search"
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MemberStatusFilter)}
              options={[
                { value: 'all', label: 'Status: Todos' },
                { value: 'active', label: STATUS_LABELS.active },
                { value: 'pending', label: STATUS_LABELS.pending },
                { value: 'blocked', label: STATUS_LABELS.blocked },
              ]}
              className="w-[160px]"
            />
            <Select
              id="group-filter"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as MemberGroupFilter)}
              options={[
                { value: 'all', label: 'Grupo: Todos' },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ]}
              className="w-[160px]"
            />
          </div>

          <MembersTable
            members={filteredMembers}
            groups={groups}
            selectedMemberId={selectedMemberId}
            isAdmin={isAdmin}
            onSelect={(m) => setSelectedMemberId(m.id)}
            onEditGroups={setEditGroupsMember}
            onApprove={handleApproveFromTable}
            onReject={handleRejectFromTable}
            onSuspend={onSuspendMember}
            onRemove={onRemoveMember}
          />

          {auditEvents.length > 0 && (
            <div className="rounded-lg border border-doqyn-border bg-doqyn-surface p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                Auditoria recente
              </h4>
              <ul className="space-y-2">
                {auditEvents.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-doqyn-text">{event.action}</span>
                    <span className="shrink-0 text-doqyn-muted">
                      {new Date(event.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <MemberDetailPanel
          member={selectedMember}
          groups={groups}
          categories={categories}
          isAdmin={isAdmin}
          onEditGroups={setEditGroupsMember}
          onChangeRole={onUpdateMemberRole}
          onSuspend={onSuspendMember}
          onRemove={(id) => {
            onRemoveMember(id);
            setSelectedMemberId(undefined);
          }}
        />
      </div>

      <EditMemberGroupsModal
        open={editGroupsMember !== null}
        member={editGroupsMember}
        groups={groups}
        onClose={() => setEditGroupsMember(null)}
        onSave={(memberId, groupIds) => {
          onUpdateMemberGroups(memberId, groupIds);
          setEditGroupsMember(null);
        }}
      />
    </div>
  );
}
