import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
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
  type PlatformRole,
  usersApi,
} from './api/usersApi';
import { cloneAccessFormState, type AccessFormState } from './accessFormState';
import { BlockAccessDialog } from './components/BlockAccessDialog';
import { EditAccessDialog } from './components/EditAccessDialog';
import { InviteMemberDialog } from './components/InviteMemberDialog';
import { UnblockAccessDialog } from './components/UnblockAccessDialog';
import { invalidateUserManagementQueries } from './userManagementQueries';
import { useCompanyMembers } from './hooks/useCompanyMembers';
import { tenantLiveSyncQueryOptions } from '@/features/tenant/tenantLiveSync';
import { useTranslation } from 'react-i18next';

const STATUS_FILTER_LABELS: Record<MemberStatus | 'all', string> = {
  all: 'Todos',
  active: 'Ativo',
  invited: 'Convidado',
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
  const { t } = useTranslation('users');

  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const sessionTenantId = tenant?.tenantId ?? user?.companyId ?? '';
  const tenantDisplayName =
    tenant?.displayName ?? user?.companyName ?? sessionTenantId ?? 'sua empresa';

  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMember, setEditingMember] = useState<CompanyMemberDto | null>(null);
  const [editAccessBaseline, setEditAccessBaseline] = useState<AccessFormState | null>(null);
  const [blockingMember, setBlockingMember] = useState<CompanyMemberDto | null>(null);
  const [unblockingMember, setUnblockingMember] = useState<CompanyMemberDto | null>(null);

  const membersQuery = useCompanyMembers(sessionTenantId);

  /**
   * Quem foi convidado e ainda não entrou.
   *
   * Consulta separada porque a origem é outra: membros vêm do Mongo do app, convites vivem no
   * auth-service. Juntá-las no servidor faria a lista de membros esperar por uma chamada externa
   * que ela não precisa — e uma falha ao ler convites apagaria a lista inteira.
   */
  const invitesQuery = useQuery({
    queryKey: ['pending-invites', sessionTenantId],
    queryFn: () => usersApi.listPendingInvites(sessionTenantId || undefined),
    enabled: Boolean(sessionTenantId),
    ...tenantLiveSyncQueryOptions(),
  });

  const documentGroupsQuery = useQuery({
    queryKey: ['document-groups', sessionTenantId],
    queryFn: () => usersApi.listDocumentGroups(),
    enabled: Boolean(sessionTenantId),
    ...tenantLiveSyncQueryOptions(),
  });

  const invalidate = async () => {
    await invalidateUserManagementQueries(queryClient, sessionTenantId || undefined);
  };

  /**
   * Convidar não usa `useMutation` como o resto da tela.
   *
   * As outras ações terminam num toast: aprovou, bloqueou, pronto. Esta produz um link, e o
   * link precisa voltar para dentro do diálogo, que o mostra até alguém copiar. Uma mutação
   * resolveria o estado de carregamento, mas o valor de retorno teria de atravessar a mesma
   * distância de qualquer jeito.
   */
  const [invitePending, setInvitePending] = useState(false);
  const createInvite = async (input: {
    email: string;
    firstName: string;
    lastName: string;
    platformRoles: PlatformRole[];
    documentGroupIds: string[];
  }) => {
    setInvitePending(true);
    try {
      const result = await usersApi.invite({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        platformRoles: input.platformRoles,
        // Os grupos não vão no convite. Quem governa é o grupo do Mongo, e ele é registrado logo
        // abaixo, na chamada que fala com o banco que decide.
        accessGroupIds: [],
        companyId: sessionTenantId || undefined,
      });
      if (!('inviteLink' in result) || !result.inviteLink) {
        throw new Error('O convite foi criado, mas o serviço não devolveu o link.');
      }

      // Nesta ordem, e não na inversa: o convite é o que pode ser recusado (e-mail duplicado,
      // papel não concedível). Guardar a intenção antes deixaria registro para um convite que
      // nunca nasceu.
      //
      // E a falha daqui para baixo não pode derrubar a criação. Passado este ponto o convite
      // existe e o e-mail já saiu: deixar a exceção subir faria o diálogo dizer "não foi
      // possível criar", o gestor tentaria de novo, e o reconvite troca o `tokenHash` — a
      // pessoa receberia dois e-mails com o primeiro link já morto.
      let groupsWarning: string | undefined;
      if (input.documentGroupIds.length > 0) {
        try {
          await usersApi.storeInviteGroups({
            email: input.email,
            documentGroupIds: input.documentGroupIds,
            companyId: sessionTenantId || undefined,
          });
        } catch {
          groupsWarning =
            'O convite vale, mas não foi possível guardar os grupos. Defina o acesso em Regras depois que a pessoa entrar.';
        }
      }

      return {
        inviteLink: result.inviteLink,
        expiresAt: result.invite.expiresAt,
        // O gestor precisa saber se o e-mail saiu. Com envio desligado ou domínio não
        // verificado, o convite é criado e nada chega — e sem este aviso ele entrega o link
        // achando que a pessoa já foi avisada.
        emailSent: result.emailSent ?? false,
        emailSkipReason: result.emailSkipReason,
        groupsWarning,
      };
    } finally {
      setInvitePending(false);
    }
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

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => usersApi.revokeInvite(inviteId),
    onSuccess: async () => {
      showAppToast({ type: 'success', title: 'Convite revogado.' });
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['pending-invites', sessionTenantId] });
    },
    onError: (err: Error) => showApiErrorToast(err),
  });

  /**
   * O convite vira uma linha na mesma tabela, e não uma seção à parte.
   *
   * Quem convidou quer ver a pessoa na lista — é isso que confirma que o convite saiu. Uma caixa
   * separada faria a lista de usuários continuar dizendo que nada aconteceu.
   *
   * O `id` é o do convite, e o status `invited` é o que a linha carrega no lugar de uma
   * membership que ainda não existe.
   */
  const invitedRows = useMemo<CompanyMemberDto[]>(() => {
    const agora = Date.now();
    return (invitesQuery.data ?? []).map((invite) => ({
      id: invite.inviteId,
      companyId: sessionTenantId,
      tenantId: sessionTenantId,
      email: invite.email,
      firstName: invite.firstName ?? undefined,
      lastName: invite.lastName ?? undefined,
      name: [invite.firstName, invite.lastName].filter(Boolean).join(' ').trim() || invite.email,
      platformRoles: invite.roles,
      tenantRoles: invite.roles,
      status: 'invited' as const,
      accessGroupIds: [],
      documentGroupIds: [],
      groupIds: [],
      createdAt: invite.createdAt,
      updatedAt: invite.expiresAt,
      // Vencido continua na lista, e de propósito: some-lo faria o convite desaparecer sem que
      // ninguém tenha sido avisado, e quem administra concluiria que a pessoa entrou.
      requestedAccess: {
        reason:
          new Date(invite.expiresAt).getTime() < agora
            ? 'Convite vencido'
            : `Convite válido até ${new Date(invite.expiresAt).toLocaleDateString('pt-BR')}`,
      },
    }));
  }, [invitesQuery.data, sessionTenantId]);

  const members = useMemo(() => {
    const list = [...invitedRows, ...(membersQuery.data?.members ?? [])];
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
  }, [invitedRows, membersQuery.data?.members, statusFilter, searchQuery]);

  const documentGroups = documentGroupsQuery.data ?? [];

  const openEditAccess = (member: CompanyMemberDto) => {
    const baseline = memberToAccessForm(member);
    setEditingMember(member);
    setEditAccessBaseline(cloneAccessFormState(baseline));
  };

  return (
    <PageShell
      eyebrow="Administração"
      title={t('usersPage.usuarios')}
      description={`Convide pessoas e gerencie acessos de ${tenantDisplayName}.`}
      actions={
        <Button type="button" onClick={() => setInviting(true)}>
          <Icon name="person_add" size={ICON_SIZE.xs} />

          {t('usersPage.convidar')}
        </Button>
      }
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
            placeholder={t('usersPage.buscarPorNomeOu')}
            className="text-label placeholder:text-doqyn-subtle"
            aria-label={t('usersPage.buscarUsuario')}
          />
        </label>

        <SegmentedTextToggle
          value={statusFilter}
          options={(['all', 'active', 'invited', 'blocked', 'rejected'] as const).map((status) => ({
            value: status,
            label: STATUS_FILTER_LABELS[status],
          }))}
          onChange={setStatusFilter}
          aria-label={t('usersPage.filtrarPorStatus')}
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
                {/* No convite ainda não há grupo aplicado — a intenção só vira vínculo quando a
                    pessoa entra. O que a coluna tem a dizer aqui é o prazo, que é o que separa um
                    convite vivo de um que já morreu. */}
                {member.status === 'invited' ? (
                  <span className="text-doqyn-muted">{member.requestedAccess?.reason ?? '—'}</span>
                ) : member.status === 'pending' && member.requestedAccess?.departmentText ? (
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
                  {
                    // Revogar é a única ação possível sobre um convite: o link só existiu em
                    // texto no instante da criação, então não há como copiá-lo de novo. Para
                    // reenviar, convida-se outra vez — e o convite novo mata o anterior.
                    label: 'Revogar convite',
                    onClick: () => revokeInviteMutation.mutate(member.id),
                    tone: 'danger',
                    hidden: member.status !== 'invited',
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {inviting && (
        <InviteMemberDialog
          documentGroups={documentGroups}
          saving={invitePending}
          onInvite={createInvite}
          onClose={() => setInviting(false)}
          onInvited={() => void invalidate()}
        />
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
    </PageShell>
  );
}
