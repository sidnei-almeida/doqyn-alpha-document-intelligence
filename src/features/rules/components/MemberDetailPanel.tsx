import { Ban, Pencil, UserX } from 'lucide-react';
import { useConfirm } from '@/components/confirm/ConfirmProvider';
import {
  buildRemoveMemberConfirm,
  buildSuspendMemberConfirm,
} from '@/components/confirm/confirmMessages';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, getAccessibleCategories } from '@/utils/rulesHelpers';
import { MemberRoleBadge } from './MemberRoleBadge';
import { MemberStatusBadge } from './MemberStatusBadge';

interface MemberDetailPanelProps {
  member: CompanyMember | null;
  groups: Group[];
  categories: DocumentCategory[];
  isAdmin: boolean;
  onEditGroups: (member: CompanyMember) => void;
  onChangeRole: (memberId: string, role: CompanyMember['role']) => void;
  onSuspend: (memberId: string) => void;
  onRemove: (memberId: string) => void;
  onApprove?: (memberId: string) => void;
  onReject?: (memberId: string) => void;
  className?: string;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export function MemberDetailPanel({
  member,
  groups,
  categories,
  isAdmin,
  onEditGroups,
  onChangeRole,
  onSuspend,
  onRemove,
  className,
}: MemberDetailPanelProps) {
  const confirm = useConfirm();

  if (!member) {
    return (
      <Card className={cn('border-doqyn-border bg-doqyn-surface', className)}>
        <CardContent className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <p className="text-sm text-doqyn-muted">
            Selecione um membro para ver detalhes, grupos e categorias acessíveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  const memberGroups = member.groupIds
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => Boolean(g));

  const accessibleCategories = getAccessibleCategories(member, categories);

  return (
    <Card className={cn('flex flex-col border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Detalhes do membro</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
        <div>
          <p className="text-sm font-medium text-doqyn-text">{member.name}</p>
          <p className="text-xs text-doqyn-muted">{member.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MemberStatusBadge status={member.status} />
            <MemberRoleBadge role={member.role} />
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          {member.position && (
            <div className="flex justify-between gap-2">
              <dt className="text-doqyn-muted">Cargo</dt>
              <dd className="text-right text-doqyn-text">{member.position}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-doqyn-muted">Último acesso</dt>
            <dd className="text-right text-doqyn-text">{member.lastAccessAt ?? 'Nunca'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-doqyn-muted">Criado em</dt>
            <dd className="text-right text-doqyn-text">{formatDate(member.createdAt)}</dd>
          </div>
          {member.approvedBy && (
            <div className="flex justify-between gap-2">
              <dt className="text-doqyn-muted">Aprovado por</dt>
              <dd className="text-right text-doqyn-text">{member.approvedBy}</dd>
            </div>
          )}
          {member.approvedAt && (
            <div className="flex justify-between gap-2">
              <dt className="text-doqyn-muted">Data da aprovação</dt>
              <dd className="text-right text-doqyn-text">{formatDate(member.approvedAt)}</dd>
            </div>
          )}
        </dl>

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
            Grupos atuais
          </p>
          <div className="flex flex-wrap gap-1.5">
            {memberGroups.length === 0 ? (
              <span className="text-xs text-doqyn-muted">Nenhum grupo</span>
            ) : (
              memberGroups.map((group) => {
                const styles = GROUP_COLOR_STYLES[group.color];
                return (
                  <span
                    key={group.id}
                    className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                      styles.badge,
                    )}
                  >
                    {group.name}
                  </span>
                );
              })
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
            Categorias acessíveis
          </p>
          {member.status !== 'active' ? (
            <p className="text-xs text-doqyn-muted">
              Acesso liberado após aprovação do administrador.
            </p>
          ) : accessibleCategories.length === 0 ? (
            <p className="text-xs text-doqyn-muted">
              Nenhuma categoria — adicione o membro a um grupo com permissões.
            </p>
          ) : (
            <ul className="space-y-1">
              {accessibleCategories.map((cat) => (
                <li key={cat.id} className="text-xs text-doqyn-text">
                  {cat.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isAdmin && member.status !== 'pending' && (
          <div className="mt-auto space-y-2 border-t border-doqyn-border-subtle pt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full border-doqyn-border"
              onClick={() => onEditGroups(member)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar grupos
            </Button>
            {member.role !== 'admin' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full border-doqyn-border"
                onClick={() =>
                  onChangeRole(member.id, member.role === 'auditor' ? 'member' : 'auditor')
                }
              >
                Alterar perfil
              </Button>
            )}
            {member.status === 'active' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full border-doqyn-warning-border text-doqyn-warning hover:bg-doqyn-warning-bg"
                onClick={async () => {
                  const ok = await confirm(buildSuspendMemberConfirm(member.name));
                  if (ok) onSuspend(member.id);
                }}
              >
                <Ban className="h-3.5 w-3.5" />
                Suspender acesso
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="w-full"
              onClick={async () => {
                const ok = await confirm(buildRemoveMemberConfirm(member.name));
                if (ok) onRemove(member.id);
              }}
            >
              <UserX className="h-3.5 w-3.5" />
              Remover membro
            </Button>
          </div>
        )}

        {isAdmin && member.status === 'pending' && (
          <p className="mt-auto border-t border-doqyn-border-subtle pt-4 text-xs text-doqyn-muted">
            Use a seção de aprovações pendentes para aprovar ou recusar este membro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
