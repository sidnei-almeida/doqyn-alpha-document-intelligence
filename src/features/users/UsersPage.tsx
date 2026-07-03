import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/auth/useAuth';
import {
  type CompanyMemberDto,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type MemberStatus,
  type PlatformRole,
  suggestGroupsFromDepartment,
  usersApi,
} from './api/usersApi';
import { cloneAccessFormState, type AccessFormState } from './accessFormState';
import {
  AccessGroupsSection,
  DocumentGroupsSection,
  NotificationsSection,
  PlatformRolesSection,
} from './components/AccessFormSections';
import { AccessRequestDetailsPanel } from './components/AccessRequestDetailsPanel';
import { BlockAccessDialog } from './components/BlockAccessDialog';
import { EditAccessDialog } from './components/EditAccessDialog';
import { UnblockAccessDialog } from './components/UnblockAccessDialog';
import { formatPlatformRoles } from './platformRoleLabels';
import { invalidateUserManagementQueries } from './userManagementQueries';

const STATUS_LABELS: Record<MemberStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Ativo', variant: 'success' },
  pending: { label: 'Pendente', variant: 'warning' },
  blocked: { label: 'Bloqueado', variant: 'danger' },
  rejected: { label: 'Rejeitado', variant: 'info' },
};

function memberDisplayName(member: CompanyMemberDto): string {
  if (member.firstName || member.lastName) {
    return [member.firstName, member.lastName].filter(Boolean).join(' ');
  }
  return member.name ?? member.email;
}

function memberToAccessForm(member: CompanyMemberDto): AccessFormState {
  return {
    platformRoles: member.platformRoles.length ? [...member.platformRoles] : ['user'],
    accessGroupIds: [...member.accessGroupIds],
    documentGroupIds: [...(member.documentGroupIds ?? member.groupIds ?? [])],
    notificationPreferences: {
      ...(member.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES),
    },
  };
}

export function UsersPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isDoqynAdmin = hasRole('doqyn_admin');
  const canAssignDoqynAdmin = isDoqynAdmin;

  const [companyId, setCompanyId] = useState(user?.companyId ?? '');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CompanyMemberDto | null>(null);
  const [editAccessBaseline, setEditAccessBaseline] = useState<AccessFormState | null>(null);
  const [approvingMember, setApprovingMember] = useState<CompanyMemberDto | null>(null);
  const [blockingMember, setBlockingMember] = useState<CompanyMemberDto | null>(null);
  const [unblockingMember, setUnblockingMember] = useState<CompanyMemberDto | null>(null);
  const [rejectingMember, setRejectingMember] = useState<CompanyMemberDto | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    platformRoles: ['user'] as PlatformRole[],
    accessGroupIds: [] as string[],
  });

  const [accessForm, setAccessForm] = useState<AccessFormState>({
    platformRoles: ['user'],
    accessGroupIds: [],
    documentGroupIds: [],
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  });

  const effectiveCompanyId = isDoqynAdmin ? companyId : (user?.companyId ?? '');

  const membersQuery = useQuery({
    queryKey: ['company-members', effectiveCompanyId],
    queryFn: () => usersApi.list(isDoqynAdmin ? effectiveCompanyId : undefined),
    enabled: !isDoqynAdmin || Boolean(effectiveCompanyId),
  });

  const groupsQuery = useQuery({
    queryKey: ['auth-access-groups', effectiveCompanyId],
    queryFn: () => usersApi.listAccessGroups(effectiveCompanyId || undefined),
    enabled: !isDoqynAdmin || Boolean(effectiveCompanyId),
  });

  const documentGroupsQuery = useQuery({
    queryKey: ['document-groups', effectiveCompanyId],
    queryFn: () => usersApi.listDocumentGroups(),
    enabled: !isDoqynAdmin || Boolean(effectiveCompanyId),
  });

  const invalidate = async () => {
    await invalidateUserManagementQueries(queryClient, effectiveCompanyId || undefined);
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      usersApi.invite({
        companyId: isDoqynAdmin ? effectiveCompanyId : undefined,
        ...inviteForm,
      }),
    onSuccess: (data) => {
      showAppToast({ type: 'success', title: 'Usuário convidado com sucesso.' });
      if (data.temporaryPassword) {
        showAppToast({
          type: 'info',
          title: 'Senha temporária (dev)',
          message: data.temporaryPassword,
          duration: 15000,
        });
      }
      setInviteOpen(false);
      setInviteForm({
        email: '',
        firstName: '',
        lastName: '',
        platformRoles: ['user'],
        accessGroupIds: [],
      });
      invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!approvingMember) throw new Error('Membro não selecionado.');
      return usersApi.approve(approvingMember.id, accessForm, effectiveCompanyId || undefined);
    },
    onSuccess: async (data) => {
      showAppToast({ type: 'success', title: 'Solicitação aprovada.' });
      if ('temporaryPassword' in data && data.temporaryPassword) {
        showAppToast({
          type: 'info',
          title: 'Senha temporária (dev)',
          message: data.temporaryPassword,
          duration: 15000,
        });
      }
      setApprovingMember(null);
      await invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason: string }) =>
      usersApi.reject(memberId, reason, effectiveCompanyId || undefined),
    onSuccess: () => {
      showAppToast({ type: 'success', title: 'Solicitação rejeitada.' });
      setRejectingMember(null);
      invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const handleRejectMember = (member: CompanyMemberDto) => {
    setRejectingMember(member);
  };

  const blockMutation = useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason?: string }) =>
      usersApi.block(memberId, effectiveCompanyId || undefined, reason),
    onSuccess: async () => {
      showAppToast({ type: 'success', title: 'Acesso bloqueado com sucesso.' });
      setBlockingMember(null);
      await invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const activateMutation = useMutation({
    mutationFn: (memberId: string) => usersApi.activate(memberId, effectiveCompanyId || undefined),
    onSuccess: async () => {
      showAppToast({ type: 'success', title: 'Acesso desbloqueado com sucesso.' });
      setUnblockingMember(null);
      await invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const tenantDisplayName =
    user?.companyName ?? effectiveCompanyId ?? user?.companyId ?? 'Empresa atual';

  const updateAccessMutation = useMutation({
    mutationFn: async (form: AccessFormState) => {
      if (!editingMember) throw new Error('Membro não selecionado.');
      await usersApi.updateAccess(
        editingMember.id,
        {
          platformRoles: form.platformRoles,
          accessGroupIds: form.accessGroupIds,
          notificationPreferences: form.notificationPreferences,
        },
        effectiveCompanyId || undefined,
      );
      await usersApi.updateDocumentGroups(
        editingMember.id,
        form.documentGroupIds,
        effectiveCompanyId || undefined,
      );
    },
    onSuccess: async () => {
      showAppToast({ type: 'success', title: 'Acesso atualizado.' });
      setEditingMember(null);
      setEditAccessBaseline(null);
      await invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const members = useMemo(() => {
    const list = membersQuery.data?.members ?? [];
    if (statusFilter === 'all') return list;
    return list.filter((m) => m.status === statusFilter);
  }, [membersQuery.data?.members, statusFilter]);

  const accessGroups = groupsQuery.data ?? [];
  const documentGroups = documentGroupsQuery.data ?? [];

  const openApprove = (member: CompanyMemberDto) => {
    const suggested = suggestGroupsFromDepartment(member.requestedAccess?.departmentText, accessGroups);
    setApprovingMember(member);
    setAccessForm({
      platformRoles: member.platformRoles.length ? member.platformRoles : ['user'],
      accessGroupIds: suggested.length ? suggested : member.accessGroupIds,
      documentGroupIds: [],
      notificationPreferences: member.notificationPreferences ?? { ...DEFAULT_NOTIFICATION_PREFERENCES },
    });
  };

  const openEditAccess = (member: CompanyMemberDto) => {
    const baseline = memberToAccessForm(member);
    setEditingMember(member);
    setEditAccessBaseline(cloneAccessFormState(baseline));
  };

  return (
    <PageShell
      title="Usuários"
      description="Convide, aprove e gerencie acessos da empresa."
      actions={<Button onClick={() => setInviteOpen(true)}>Convidar usuário</Button>}
      bodyClassName="min-h-0"
    >
      {isDoqynAdmin && (
        <Card className="shrink-0">
          <CardContent className="flex flex-wrap items-end gap-4 p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-doqyn-muted">Empresa (companyId)</label>
              <Input
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="company_dev"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex shrink-0 flex-wrap gap-2">
        {(['all', 'active', 'pending', 'blocked', 'rejected'] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {status === 'all' ? 'Todos' : STATUS_LABELS[status].label}
          </Button>
        ))}
      </div>

      <Card className="flex min-h-[420px] flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {membersQuery.isLoading ? (
            <p className="flex flex-1 items-center justify-center p-6 text-sm text-doqyn-muted">
              Carregando usuários...
            </p>
          ) : members.length === 0 ? (
            <p className="flex flex-1 items-center justify-center p-6 text-sm text-doqyn-muted">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-doqyn-border text-xs uppercase text-doqyn-muted">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Grupos de acesso</th>
                    <th className="px-4 py-3">Grupos documentais</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const statusConfig = STATUS_LABELS[member.status];
                    return (
                      <tr key={member.id} className="border-b border-doqyn-border-subtle">
                        <td className="px-4 py-3 font-medium">{memberDisplayName(member)}</td>
                        <td className="px-4 py-3 text-doqyn-muted">{member.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-doqyn-muted">
                          {formatPlatformRoles(member.platformRoles)}
                        </td>
                        <td className="px-4 py-3 text-xs text-doqyn-muted">
                          {member.requestedAccess?.departmentText && member.status === 'pending' ? (
                            <span title={member.requestedAccess.reason}>
                              {member.requestedAccess.departmentText}
                            </span>
                          ) : member.accessGroupIds.length ? (
                            member.accessGroupIds
                              .map((id) => accessGroups.find((g) => g.id === id)?.name ?? id)
                              .join(', ')
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-doqyn-muted">
                          {(member.documentGroupIds ?? member.groupIds).length ? (
                            (member.documentGroupIds ?? member.groupIds)
                              .map((id) => documentGroups.find((g) => g.id === id)?.name ?? id)
                              .join(', ')
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {member.status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => openApprove(member)}>
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleRejectMember(member)}
                                >
                                  Rejeitar
                                </Button>
                              </>
                            )}
                            {member.status === 'active' && (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => openEditAccess(member)}>
                                  Editar acesso
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setBlockingMember(member)}
                                >
                                  Bloquear acesso
                                </Button>
                              </>
                            )}
                            {member.status === 'blocked' && (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => openEditAccess(member)}>
                                  Editar acesso
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setUnblockingMember(member)}
                                >
                                  Desbloquear acesso
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-medium">Convidar usuário</h2>
              <Input
                placeholder="E-mail"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Nome"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                />
                <Input
                  placeholder="Sobrenome"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <PlatformRolesSection
                value={inviteForm.platformRoles}
                onChange={(platformRoles) => setInviteForm((f) => ({ ...f, platformRoles }))}
                canAssignDoqynAdmin={canAssignDoqynAdmin}
              />
              <AccessGroupsSection
                groups={accessGroups}
                value={inviteForm.accessGroupIds}
                onChange={(accessGroupIds) => setInviteForm((f) => ({ ...f, accessGroupIds }))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Convidando…' : 'Convidar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {approvingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <CardContent className="space-y-1 p-6">
              <h2 className="mb-4 text-lg font-medium">Aprovar {memberDisplayName(approvingMember)}</h2>
              <AccessRequestDetailsPanel
                member={approvingMember}
                className="mb-4 rounded-md border border-doqyn-border bg-doqyn-surface p-3 text-xs"
              />
              {suggestGroupsFromDepartment(
                approvingMember.requestedAccess?.departmentText,
                accessGroups,
              ).length > 0 && (
                <p className="mb-4 text-xs text-doqyn-muted">
                  Sugestão: talvez corresponda ao grupo{' '}
                  {accessGroups
                    .filter((g) =>
                      suggestGroupsFromDepartment(
                        approvingMember.requestedAccess?.departmentText,
                        accessGroups,
                      ).includes(g.id),
                    )
                    .map((g) => g.name)
                    .join(', ')}
                </p>
              )}
              <PlatformRolesSection
                value={accessForm.platformRoles}
                onChange={(platformRoles) => setAccessForm((f) => ({ ...f, platformRoles }))}
                canAssignDoqynAdmin={canAssignDoqynAdmin}
              />
              <AccessGroupsSection
                groups={accessGroups}
                value={accessForm.accessGroupIds}
                onChange={(accessGroupIds) => setAccessForm((f) => ({ ...f, accessGroupIds }))}
              />
              <DocumentGroupsSection
                groups={documentGroups}
                value={accessForm.documentGroupIds}
                onChange={(documentGroupIds) =>
                  setAccessForm((f) => ({ ...f, documentGroupIds }))
                }
              />
              <NotificationsSection
                value={accessForm.notificationPreferences}
                onChange={(notificationPreferences) =>
                  setAccessForm((f) => ({ ...f, notificationPreferences }))
                }
              />
              <div className="flex justify-end gap-2 border-t border-doqyn-border-subtle pt-4">
                <Button variant="secondary" onClick={() => setApprovingMember(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? 'Aprovando…' : 'Aprovar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingMember && editAccessBaseline && (
        <EditAccessDialog
          member={editingMember}
          memberName={memberDisplayName(editingMember)}
          initialForm={editAccessBaseline}
          accessGroups={accessGroups}
          documentGroups={documentGroups}
          canAssignDoqynAdmin={canAssignDoqynAdmin}
          saving={updateAccessMutation.isPending}
          onClose={() => {
            setEditingMember(null);
            setEditAccessBaseline(null);
          }}
          onSave={(form) => updateAccessMutation.mutate(form)}
        />
      )}

      {blockingMember && (
        <BlockAccessDialog
          member={blockingMember}
          memberName={memberDisplayName(blockingMember)}
          tenantDisplayName={tenantDisplayName}
          blocking={blockMutation.isPending}
          onClose={() => setBlockingMember(null)}
          onConfirm={(reason) =>
            blockMutation.mutate({ memberId: blockingMember.id, reason })
          }
        />
      )}

      {unblockingMember && (
        <UnblockAccessDialog
          member={unblockingMember}
          memberName={memberDisplayName(unblockingMember)}
          tenantDisplayName={tenantDisplayName}
          unblocking={activateMutation.isPending}
          onClose={() => setUnblockingMember(null)}
          onConfirm={() => activateMutation.mutate(unblockingMember.id)}
        />
      )}

      <PromptDialog
        open={Boolean(rejectingMember)}
        title="Rejeitar solicitação"
        description={
          rejectingMember
            ? `${memberDisplayName(rejectingMember)} · ${rejectingMember.email}`
            : undefined
        }
        label="Motivo da rejeição"
        placeholder="Descreva o motivo para o solicitante..."
        confirmLabel="Confirmar rejeição"
        saving={rejectMutation.isPending}
        onClose={() => setRejectingMember(null)}
        onConfirm={(reason) => {
          if (!rejectingMember) return;
          rejectMutation.mutate({ memberId: rejectingMember.id, reason });
        }}
      />
    </PageShell>
  );
}
