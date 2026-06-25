import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/auth/useAuth';
import { getAccessGroups } from '@/features/rules/api/rulesApi';
import {
  type CompanyMemberDto,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type MemberStatus,
  type NotificationPreferencesDto,
  type PlatformRole,
  suggestGroupsFromDepartment,
  usersApi,
} from './api/usersApi';

const PLATFORM_ROLES: PlatformRole[] = ['doqyn_admin', 'company_admin', 'user'];

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

function RoleCheckboxes({
  value,
  onChange,
  canAssignDoqynAdmin,
}: {
  value: PlatformRole[];
  onChange: (roles: PlatformRole[]) => void;
  canAssignDoqynAdmin: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {PLATFORM_ROLES.map((role) => {
        const disabled = role === 'doqyn_admin' && !canAssignDoqynAdmin;
        const checked = value.includes(role);
        return (
          <label key={role} className="flex items-center gap-2 text-sm text-doqyn-text">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (checked) {
                  onChange(value.filter((r) => r !== role));
                } else {
                  onChange([...value, role]);
                }
              }}
            />
            {role}
          </label>
        );
      })}
    </div>
  );
}

function GroupCheckboxes({
  groups,
  value,
  onChange,
}: {
  groups: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const checked = value.includes(group.id);
        return (
          <label key={group.id} className="flex items-center gap-2 text-sm text-doqyn-text">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                if (checked) {
                  onChange(value.filter((id) => id !== group.id));
                } else {
                  onChange([...value, group.id]);
                }
              }}
            />
            {group.name}
          </label>
        );
      })}
    </div>
  );
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
  const [approvingMember, setApprovingMember] = useState<CompanyMemberDto | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    platformRoles: ['user'] as PlatformRole[],
    accessGroupIds: [] as string[],
  });

  const [accessForm, setAccessForm] = useState({
    platformRoles: ['user'] as PlatformRole[],
    accessGroupIds: [] as string[],
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  });

  const effectiveCompanyId = isDoqynAdmin ? companyId : (user?.companyId ?? '');

  const membersQuery = useQuery({
    queryKey: ['company-members', effectiveCompanyId],
    queryFn: () => usersApi.list(isDoqynAdmin ? effectiveCompanyId : undefined),
  });

  const groupsQuery = useQuery({
    queryKey: ['access-groups'],
    queryFn: getAccessGroups,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['company-members'] });
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      usersApi.invite({
        companyId: isDoqynAdmin ? effectiveCompanyId : undefined,
        ...inviteForm,
      }),
    onSuccess: (data) => {
      toast.success('Usuário convidado com sucesso.');
      if (data.temporaryPassword) {
        toast.info(`Senha temporária (dev): ${data.temporaryPassword}`, { duration: 15000 });
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
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!approvingMember) throw new Error('Membro não selecionado.');
      return usersApi.approve(approvingMember.id, accessForm);
    },
    onSuccess: (data) => {
      toast.success('Solicitação aprovada.');
      if (data.temporaryPassword) {
        toast.info(`Senha temporária (dev): ${data.temporaryPassword}`, { duration: 15000 });
      }
      setApprovingMember(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (memberId: string) => usersApi.reject(memberId),
    onSuccess: () => {
      toast.success('Solicitação rejeitada.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const blockMutation = useMutation({
    mutationFn: (memberId: string) => usersApi.block(memberId),
    onSuccess: () => {
      toast.success('Usuário bloqueado.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (memberId: string) => usersApi.activate(memberId),
    onSuccess: () => {
      toast.success('Usuário reativado.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAccessMutation = useMutation({
    mutationFn: () => {
      if (!editingMember) throw new Error('Membro não selecionado.');
      return usersApi.updateAccess(editingMember.id, accessForm);
    },
    onSuccess: () => {
      toast.success('Acesso atualizado.');
      setEditingMember(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const members = useMemo(() => {
    const list = membersQuery.data?.members ?? [];
    if (statusFilter === 'all') return list;
    return list.filter((m) => m.status === statusFilter);
  }, [membersQuery.data?.members, statusFilter]);

  const groups = groupsQuery.data ?? [];

  const openApprove = (member: CompanyMemberDto) => {
    const suggested = suggestGroupsFromDepartment(member.requestedAccess?.departmentText, groups);
    setApprovingMember(member);
    setAccessForm({
      platformRoles: member.platformRoles.length ? member.platformRoles : ['user'],
      accessGroupIds: suggested.length ? suggested : member.accessGroupIds,
      notificationPreferences: member.notificationPreferences ?? { ...DEFAULT_NOTIFICATION_PREFERENCES },
    });
  };

  const openEditAccess = (member: CompanyMemberDto) => {
    setEditingMember(member);
    setAccessForm({
      platformRoles: member.platformRoles.length ? member.platformRoles : ['user'],
      accessGroupIds: member.accessGroupIds,
      notificationPreferences: member.notificationPreferences ?? { ...DEFAULT_NOTIFICATION_PREFERENCES },
    });
  };

  function NotificationCheckboxes({
    value,
    onChange,
  }: {
    value: NotificationPreferencesDto;
    onChange: (value: NotificationPreferencesDto) => void;
  }) {
    const entries: Array<[keyof NotificationPreferencesDto, string]> = [
      ['email', 'E-mail'],
      ['whatsapp', 'WhatsApp'],
      ['documentCreated', 'Documento criado'],
      ['documentUpdated', 'Documento atualizado'],
      ['documentRequiresSignature', 'Assinatura necessária'],
      ['accessApproved', 'Acesso aprovado'],
      ['accessRejected', 'Acesso rejeitado'],
    ];

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Convide, aprove e gerencie acessos da empresa."
        actions={
          <Button onClick={() => setInviteOpen(true)}>Convidar usuário</Button>
        }
      />

      {isDoqynAdmin && (
        <Card>
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

      <div className="flex flex-wrap gap-2">
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

      <Card>
        <CardContent className="p-0">
          {membersQuery.isLoading ? (
            <p className="p-6 text-sm text-doqyn-muted">Carregando usuários...</p>
          ) : members.length === 0 ? (
            <p className="p-6 text-sm text-doqyn-muted">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-doqyn-border text-xs uppercase text-doqyn-muted">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Grupos</th>
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
                          {member.platformRoles.join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-doqyn-muted">
                          {member.requestedAccess?.departmentText && member.status === 'pending' ? (
                            <span title={member.requestedAccess.reason}>
                              {member.requestedAccess.departmentText}
                            </span>
                          ) : (
                            member.accessGroupIds.length || '—'
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
                                  onClick={() => rejectMutation.mutate(member.id)}
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
                                  onClick={() => blockMutation.mutate(member.id)}
                                >
                                  Bloquear
                                </Button>
                              </>
                            )}
                            {member.status === 'blocked' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => activateMutation.mutate(member.id)}
                              >
                                Reativar
                              </Button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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
              <div>
                <p className="mb-2 text-xs text-doqyn-muted">Roles globais</p>
                <RoleCheckboxes
                  value={inviteForm.platformRoles}
                  onChange={(platformRoles) => setInviteForm((f) => ({ ...f, platformRoles }))}
                  canAssignDoqynAdmin={canAssignDoqynAdmin}
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-doqyn-muted">Grupos de acesso</p>
                <GroupCheckboxes
                  groups={groups}
                  value={inviteForm.accessGroupIds}
                  onChange={(accessGroupIds) => setInviteForm((f) => ({ ...f, accessGroupIds }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                  Convidar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {approvingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-medium">Aprovar {memberDisplayName(approvingMember)}</h2>
              {approvingMember.requestedAccess && (
                <div className="rounded-md border border-doqyn-border bg-doqyn-surface p-3 text-xs text-doqyn-muted">
                  <p>
                    Cliente: {approvingMember.requestedAccess.tenantDisplayName ?? '—'} (
                    {approvingMember.requestedAccess.taxIdType})
                  </p>
                  <p>Cargo: {approvingMember.requestedAccess.jobTitle ?? '—'}</p>
                  <p>Setor informado: {approvingMember.requestedAccess.departmentText ?? '—'}</p>
                  <p>Motivo: {approvingMember.requestedAccess.reason ?? '—'}</p>
                  {approvingMember.whatsapp && <p>WhatsApp: {approvingMember.whatsapp}</p>}
                  {suggestGroupsFromDepartment(
                    approvingMember.requestedAccess.departmentText,
                    groups,
                  ).length > 0 && (
                    <p className="mt-2 text-doqyn-text">
                      Sugestão: talvez corresponda ao grupo{' '}
                      {groups
                        .filter((g) =>
                          suggestGroupsFromDepartment(
                            approvingMember.requestedAccess?.departmentText,
                            groups,
                          ).includes(g.id),
                        )
                        .map((g) => g.name)
                        .join(', ')}
                    </p>
                  )}
                </div>
              )}
              <RoleCheckboxes
                value={accessForm.platformRoles}
                onChange={(platformRoles) => setAccessForm((f) => ({ ...f, platformRoles }))}
                canAssignDoqynAdmin={canAssignDoqynAdmin}
              />
              <GroupCheckboxes
                groups={groups}
                value={accessForm.accessGroupIds}
                onChange={(accessGroupIds) => setAccessForm((f) => ({ ...f, accessGroupIds }))}
              />
              <div>
                <p className="mb-2 text-xs text-doqyn-muted">Notificações futuras</p>
                <NotificationCheckboxes
                  value={accessForm.notificationPreferences}
                  onChange={(notificationPreferences) =>
                    setAccessForm((f) => ({ ...f, notificationPreferences }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setApprovingMember(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Aprovar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-medium">Editar acesso — {memberDisplayName(editingMember)}</h2>
              <RoleCheckboxes
                value={accessForm.platformRoles}
                onChange={(platformRoles) => setAccessForm((f) => ({ ...f, platformRoles }))}
                canAssignDoqynAdmin={canAssignDoqynAdmin}
              />
              <GroupCheckboxes
                groups={groups}
                value={accessForm.accessGroupIds}
                onChange={(accessGroupIds) => setAccessForm((f) => ({ ...f, accessGroupIds }))}
              />
              <div>
                <p className="mb-2 text-xs text-doqyn-muted">Notificações futuras</p>
                <NotificationCheckboxes
                  value={accessForm.notificationPreferences}
                  onChange={(notificationPreferences) =>
                    setAccessForm((f) => ({ ...f, notificationPreferences }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditingMember(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => updateAccessMutation.mutate()}
                  disabled={updateAccessMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
