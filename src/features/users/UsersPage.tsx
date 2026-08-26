import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Modal } from '@/components/ui/Modal';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { showApiErrorToast, showAppToast } from '@/shared/feedback/appFeedback';
import { MemberStatusBadge } from '@/components/ui/MemberStatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { InlineErrorHint } from '@/components/ui/InlineErrorHint';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { SegmentedTextToggle } from '@/components/ui/SegmentedTextToggle';
import { PlatformRoleChips } from '@/components/ui/PlatformRoleChips';
import { Tooltip } from '@/components/ui/Tooltip';
import { TableRowActionsMenu } from '@/components/ui/TableRowActionsMenu';
import { useAuth } from '@/auth/useAuth';
import {
  type CompanyMemberDto,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type MemberStatus,
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
    // Espalhado sobre o default, não em lugar dele: quem foi gravado antes de um evento existir
    // não tem a chave nova, e sem a mescla a caixa apareceria desmarcada enquanto o servidor
    // tratava como ligada.
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(member.notificationPreferences ?? {}),
    },
  };
}

export function UsersPage() {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const sessionTenantId = tenant?.tenantId ?? user?.companyId ?? '';
  const tenantDisplayName =
    tenant?.displayName ?? user?.companyName ?? sessionTenantId ?? 'sua empresa';

  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMember, setEditingMember] = useState<CompanyMemberDto | null>(null);
  const [editAccessBaseline, setEditAccessBaseline] = useState<AccessFormState | null>(null);
  const [approvingMember, setApprovingMember] = useState<CompanyMemberDto | null>(null);
  const [blockingMember, setBlockingMember] = useState<CompanyMemberDto | null>(null);
  const [unblockingMember, setUnblockingMember] = useState<CompanyMemberDto | null>(null);
  const [rejectingMember, setRejectingMember] = useState<CompanyMemberDto | null>(null);

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
      notificationPreferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(member.notificationPreferences ?? {}),
      },
    });
  };

  const openEditAccess = (member: CompanyMemberDto) => {
    const baseline = memberToAccessForm(member);
    setEditingMember(member);
    setEditAccessBaseline(cloneAccessFormState(baseline));
  };

  return (
    <PageShell
      eyebrow="Administração"
      title="Usuários"
      description={`Aprove e gerencie acessos de ${tenantDisplayName}.`}
      bodyClassName="min-h-0"
    >
      {/* A barra de filtros era um card com borda em volta de um campo e cinco
          botões preenchidos — cinco ações principais para uma escolha que é
          ajuste de vista. Agora é campo em régua, status em régua e a contagem
          em monoespaçado na outra ponta. */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <label className="field-rule w-full sm:max-w-xs">
          <Icon name="search" size={ICON_SIZE.xs} className="shrink-0 text-doqyn-subtle" />
          <input
            id="users-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="text-label placeholder:text-doqyn-subtle"
            aria-label="Buscar usuário"
          />
        </label>

        <SegmentedTextToggle
          value={statusFilter}
          options={(['all', 'active', 'pending', 'blocked', 'rejected'] as const).map((status) => ({
            value: status,
            label: STATUS_FILTER_LABELS[status],
          }))}
          onChange={setStatusFilter}
          aria-label="Filtrar por status"
        />

        <span className="ml-auto pb-2 font-mono text-micro tabular-nums text-doqyn-subtle">
          {members.length} {members.length === 1 ? 'usuário' : 'usuários'}
        </span>
      </div>

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
            ? 'Não foi possível carregar os usuários'
            : membersQuery.isLoading
              ? 'Carregando usuários'
              : statusFilter === 'all'
                ? 'Nenhum usuário ainda'
                : `Nenhum usuário ${STATUS_FILTER_LABELS[statusFilter].toLowerCase()}`
        }
        emptyDescription={
          statusFilter === 'all'
            ? 'Ninguém com acesso à empresa por enquanto.'
            : 'Troque o filtro para ver os outros registros.'
        }
        sparseMessage="Só isto nesta seleção"
        sparseDescription="Troque o filtro de status para ver os outros registros."
        columns={[
          {
            key: 'name',
            header: 'Nome',
            render: (member) => <span className="font-medium">{memberDisplayName(member)}</span>,
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
                  <Tooltip
                    label={member.requestedAccess.reason ?? 'Departamento informado na solicitação'}
                  >
                    <span className="text-doqyn-muted">
                      {member.requestedAccess.departmentText}
                    </span>
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

      {approvingMember && (
        <Modal
          open
          onClose={() => setApprovingMember(null)}
          title={`Aprovar ${memberDisplayName(approvingMember)}`}
          subtitle={approvingMember.email}
          size="lg"
          // Papel, grupos e avisos já escolhidos: clicar fora não descarta em silêncio.
          dismissOnOverlay={false}
          footer={
            <>
              <Button variant="secondary" onClick={() => setApprovingMember(null)}>
                Cancelar
              </Button>
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? 'Aprovando…' : 'Aprovar'}
              </Button>
            </>
          }
        >
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
          />
          <DocumentGroupsSection
            groups={documentGroups}
            value={accessForm.documentGroupIds}
            onChange={(documentGroupIds) => setAccessForm((f) => ({ ...f, documentGroupIds }))}
          />
          <NotificationsSection
            value={accessForm.notificationPreferences}
            onChange={(notificationPreferences) =>
              setAccessForm((f) => ({ ...f, notificationPreferences }))
            }
          />
        </Modal>
      )}

      {editingMember && editAccessBaseline && (
        <EditAccessDialog
          member={editingMember}
          memberName={memberDisplayName(editingMember)}
          initialForm={editAccessBaseline}
          documentGroups={documentGroups}
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
          onConfirm={(reason) => blockMutation.mutate({ memberId: blockingMember.id, reason })}
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
