import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, ROLE_LABELS, STATUS_LABELS, getAccessibleCategories } from '@/utils/rulesHelpers';
import { MemberRoleBadge } from './MemberRoleBadge';
import { MemberStatusBadge } from './MemberStatusBadge';

interface AccessSummaryPanelProps {
  member: CompanyMember | null;
  groups: Group[];
  categories: DocumentCategory[];
  className?: string;
}

export function AccessSummaryPanel({
  member,
  groups,
  categories,
  className,
}: AccessSummaryPanelProps) {
  if (!member) {
    return (
      <Card className={cn('border-doqyn-border bg-doqyn-surface', className)}>
        <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-sm text-doqyn-muted">
            Selecione um usuário para ver o resumo de acesso.
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
    <Card className={cn('border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resumo de acesso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium text-doqyn-text">{member.name}</p>
          <p className="text-xs text-doqyn-muted">{member.position ?? member.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MemberStatusBadge status={member.status} />
            <MemberRoleBadge role={member.role} />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
            Grupos atuais
          </p>
          {memberGroups.length === 0 ? (
            <p className="text-xs text-doqyn-muted">Nenhum grupo atribuído</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {memberGroups.map((g) => {
                const styles = GROUP_COLOR_STYLES[g.color];
                return (
                  <span
                    key={g.id}
                    className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', styles.badge)}
                  >
                    {g.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
            Categorias acessíveis
          </p>
          {member.status !== 'active' ? (
            <p className="text-xs text-doqyn-muted">
              Disponível após aprovação do administrador.
            </p>
          ) : accessibleCategories.length === 0 ? (
            <p className="text-xs text-doqyn-muted">
              Nenhuma — arraste o usuário para um grupo com permissões.
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

        <dl className="space-y-1 border-t border-doqyn-border-subtle pt-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-doqyn-muted">Perfil</dt>
            <dd className="text-doqyn-text">{ROLE_LABELS[member.role]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-doqyn-muted">Status</dt>
            <dd className="text-doqyn-text">{STATUS_LABELS[member.status]}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
