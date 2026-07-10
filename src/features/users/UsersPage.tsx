import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import { MemberStatusBadge } from '@/components/ui/MemberStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterBarField } from '@/components/ui/FilterBar';
import { InlineErrorHint } from '@/components/ui/InlineErrorHint';
import { PlatformRoleChips } from '@/components/ui/PlatformRoleChips';
import { Tooltip } from '@/components/ui/Tooltip';
import { TableRowActionsMenu } from '@/components/ui/TableRowActionsMenu';
import { Input } from '@/components/ui/Input';
import { ExternalInviteLinkField } from '@/components/ui/ExternalInviteLinkField';
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
  DocumentGroupsSection,
  NotificationsSection,
  PlatformRolesSection,
} from './components/AccessFormSections';
import { AccessRequestDetailsPanel } from './components/AccessRequestDetailsPanel';
import { BlockAccessDialog } from './components/BlockAccessDialog';
import { EditAccessDialog } from './components/EditAccessDialog';
import { UnblockAccessDialog } from './components/UnblockAccessDialog';
import { invalidateUserManagementQueries } from './userManagementQueries';
import { useCompanyMembers } from './hooks/useCompanyMembers';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';

const STATUS_FILTER_LABELS: Record<MemberStatus | 'all', string> = {
  all: 'Todos',
  active: 'Ativo',
  pending: 'Pendente',
  blocked: 'Bloqueado',
  rejected: 'Rejeitado',
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
  const { user, tenant, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isDoqynAdmin = hasRole('doqyn_admin');
  const canAssignDoqynAdmin = isDoqynAdmin;
  const sessionTenantId = tenant?.tenantId ?? user?.companyId ?? '';
  const tenantDisplayName =
    tenant?.displayName ?? user?.companyName ?? sessionTenantId ?? 'sua empresa';

  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ link: string; intro: string } | null>(null);
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

  const membersQuery = useCompanyMembers(sessionTenantId);

  const documentGroupsQuery = useQuery({
    queryKey: ['document-groups', sessionTenantId],
    queryFn: () => usersApi.listDocumentGroups(),
    enabled: Boolean(sessionTenantId),
    ...tenantLiveSyncQueryOptions(),
  });

  const invalidate = async () => {
    await invalidateUserManagementQueries(queryClient, sessionTenantId || undefined);
  };

  const closeInviteModal = () => {
    setInviteOpen(false);
    setInviteResult(null);
    setInviteForm({
      email: '',
      firstName: '',
      lastName: '',
      platformRoles: ['user'],
      accessGroupIds: [],
    });
  };

  const openInviteModal = () => {
    setInviteResult(null);
    setInviteOpen(true);
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      usersApi.invite({
        ...inviteForm,
      }),
    onSuccess: (data) => {
      if (data.emailSent) {
        showAppToast({
          type: 'success',
          title: 'Convite enviado por e-mail.',
          message: 'O convidado receberá o link no e-mail informado.',
        });
        closeInviteModal();
        void invalidate();
        return;
      }

      if ('inviteLink' in data && typeof data.inviteLink === 'string') {
        const reasonMessages: Record<string, string> = {
          smtp_not_configured:
            'Convite criado. Configure o SMTP em Configurações → Empresa → Governança para envio automático por e-mail.',
          email_disabled:
            'Convite criado. O envio automático está desativado neste ambiente — compartilhe o link abaixo com o convidado.',
          domain_mismatch:
            'Convite criado. Seu e-mail precisa ser do mesmo domínio do SMTP da empresa para envio automático.',
          send_failed:
            'Convite criado, mas o e-mail não foi enviado. Compartilhe o link abaixo com o convidado.',
        };
        const reason =
          'emailSkipReason' in data && typeof data.emailSkipReason === 'string'
            ? data.emailSkipReason
            : undefined;
        setInviteResult({
          link: data.inviteLink,
          intro:
            reason && reasonMessages[reason]
              ? reasonMessages[reason]
              : 'Convite criado. Compartilhe o link abaixo com o convidado.',
        });
        void invalidate();
        return;
      }

      showAppToast({ type: 'success', title: 'Usuário convidado com sucesso.' });
      if ('temporaryPassword' in data && data.temporaryPassword) {
        showAppToast({
          type: 'info',
          title: 'Senha temporária (dev)',
          message: data.temporaryPassword,
          duration: 15000,
        });
      }
      closeInviteModal();
      void invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!approvingMember) throw new Error('Membro não selecionado.');
      return usersApi.approve(approvingMember.id, accessForm);
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
      usersApi.reject(memberId, reason),
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
      usersApi.block(memberId, undefined, reason),
    onSuccess: async () => {
      showAppToast({ type: 'success', title: 'Acesso bloqueado com sucesso.' });
      setBlockingMember(null);
      await invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const activateMutation = useMutation({
    mutationFn: (memberId: string) => usersApi.activate(memberId),
    onSuccess: async () => {
      showAppToast({ type: 'success', title: 'Acesso desbloqueado com sucesso.' });
      setUnblockingMember(null);
      await invalidate();
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  const updateAccessMutation = useMutation({
    mutationFn: async (form: AccessFormState) => {
      if (!editingMember) throw new Error('Membro não selecionado.');
      await usersApi.updateAccess(editingMember.id, {
        platformRoles: form.platformRoles,
        accessGroupIds: editingMember.accessGroupIds,
        notificationPreferences: form.notificationPreferences,
      });
      await usersApi.updateDocumentGroups(editingMember.id, form.documentGroupIds);
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
    const query = searchQuery.trim().toLowerCase();
    return list.filter((member) => {
      if (statusFilter !== 'all' && member.status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        memberDisplayName(member),
        member.email,
        member.username,
        member.firstName,
        member.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [membersQuery.data?.members, statusFilter, searchQuery]);

  const documentGroups = documentGroupsQuery.data ?? [];

  const openApprove = (member: CompanyMemberDto) => {
    const suggested = suggestGroupsFromDepartment(
      member.requestedAccess?.departmentText,
      documentGroups,
    );
    setApprovingMember(member);
    setAccessForm({
      platformRoles: member.platformRoles.length ? member.platformRoles : ['user'],
      accessGroupIds: [],
      documentGroupIds: suggested,
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
      description={`Convide, aprove e gerencie acessos de ${tenantDisplayName}.`}
      actions={<Button onClick={openInviteModal}>Convidar usuário</Button>}
      bodyClassName="min-h-0"
    >
      <FilterBar summary={`${members.length} ${members.length === 1 ? 'usuário' : 'usuários'}`}>
        <FilterBarField span={2} className="lg:col-span-2">
          <Input
            id="users-search"
            label="Buscar"
            placeholder="Nome ou e-mail..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </FilterBarField>
        <FilterBarField span={2} className="lg:col-span-2">
          <div>
            <p className="form-label mb-1.5">Status</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'pending', 'blocked', 'rejected'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {STATUS_FILTER_LABELS[status]}
                </Button>
              ))}
            </div>
          </div>
        </FilterBarField>
      </FilterBar>

      {membersQuery.isError ? (
        <InlineErrorHint
          message="Não foi possível carregar os usuários da empresa."
          onRetry={() => void membersQuery.refetch()}
          className="mb-4"
        />
      ) : null}

      <DataTable
        stretch
        className="flex-1"
        data={membersQuery.isLoading ? [] : members}
        keyExtractor={(member) => member.id}
        emptyMessage={
          membersQuery.isError
            ? 'Falha ao carregar usuários'
            : membersQuery.isLoading
              ? 'Carregando usuários...'
              : 'Nenhum usuário encontrado'
        }
        emptyDescription={
          statusFilter === 'all'
            ? 'Convide colaboradores para começar a gerenciar acessos da empresa.'
            : 'Nenhum usuário corresponde ao status selecionado.'
        }
        emptyAction={
          !membersQuery.isLoading && statusFilter === 'all' ? (
            <Button onClick={openInviteModal}>Convidar usuário</Button>
          ) : undefined
        }
        sparseMessage="Nenhum outro usuário nesta listagem"
        sparseDescription="Altere o filtro de status para ver outros registros."
        columns={[
          {
            key: 'name',
            header: 'Nome',
            render: (member) => (
              <span className="font-medium">{memberDisplayName(member)}</span>
            ),
          },
          {
            key: 'email',
            header: 'E-mail',
            render: (member) => <span className="text-doqyn-muted">{member.email}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (member) => <MemberStatusBadge status={member.status} />,
          },
          {
            key: 'roles',
            header: 'Roles',
            render: (member) => <PlatformRoleChips roles={member.platformRoles} />,
          },
          {
            key: 'groups',
            header: 'Grupos',
            render: (member) => (
              <span className="meta-text">
                {member.status === 'pending' && member.requestedAccess?.departmentText ? (
                  <Tooltip label={member.requestedAccess.reason ?? 'Departamento informado na solicitação'}>
                    <span className="text-doqyn-muted">{member.requestedAccess.departmentText}</span>
                  </Tooltip>
                ) : (member.documentGroupIds ?? member.groupIds).length ? (
                  (member.documentGroupIds ?? member.groupIds)
                    .map((id) => documentGroups.find((g) => g.id === id)?.name ?? id)
                    .join(', ')
                ) : (
                  '—'
                )}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            headerClassName: 'w-12 text-right',
            className: 'text-right',
            render: (member) => (
              <TableRowActionsMenu
                actions={[
                  {
                    label: 'Aprovar',
                    onClick: () => openApprove(member),
                    hidden: member.status !== 'pending',
                  },
                  {
                    label: 'Rejeitar',
                    onClick: () => handleRejectMember(member),
                    hidden: member.status !== 'pending',
                  },
                  {
                    label: 'Editar acesso',
                    onClick: () => openEditAccess(member),
                    hidden: member.status !== 'active' && member.status !== 'blocked',
                  },
                  {
                    label: 'Bloquear acesso',
                    onClick: () => setBlockingMember(member),
                    tone: 'danger',
                    hidden: member.status !== 'active',
                  },
                  {
                    label: 'Desbloquear acesso',
                    onClick: () => setUnblockingMember(member),
                    hidden: member.status !== 'blocked',
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-medium">
                {inviteResult ? 'Convite criado' : 'Convidar usuário'}
              </h2>

              {inviteResult ? (
                <div className="space-y-4" data-testid="user-invite-link-success">
                  <ExternalInviteLinkField
                    value={inviteResult.link}
                    intro={inviteResult.intro}
                    testId="user-invite-link"
                  />
                  <div className="flex justify-end">
                    <Button type="button" onClick={closeInviteModal}>
                      Fechar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
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
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={closeInviteModal}>
                      Cancelar
                    </Button>
                    <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? 'Convidando…' : 'Convidar'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {approvingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
            <CardContent className="space-y-1 p-6">
              <h2 className="mb-4 text-lg font-medium">Aprovar {memberDisplayName(approvingMember)}</h2>
              <AccessRequestDetailsPanel
                member={approvingMember}
                className="mb-4 rounded-md border border-doqyn-border bg-doqyn-surface p-3 text-xs"
              />
              {suggestGroupsFromDepartment(
                approvingMember.requestedAccess?.departmentText,
                documentGroups,
              ).length > 0 && (
                <p className="mb-4 text-xs text-doqyn-muted">
                  Sugestão: talvez corresponda ao grupo{' '}
                  {documentGroups
                    .filter((g) =>
                      suggestGroupsFromDepartment(
                        approvingMember.requestedAccess?.departmentText,
                        documentGroups,
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
