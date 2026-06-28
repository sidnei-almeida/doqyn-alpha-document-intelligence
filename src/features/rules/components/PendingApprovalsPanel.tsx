import { Check, X } from 'lucide-react';
import { useConfirm } from '@/components/confirm/useConfirm';
import { buildRejectApprovalConfirm } from '@/components/confirm/confirmMessages';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PendingApproval, UserRole } from '@/types/rules';
import { getInitials } from '@/utils/rulesHelpers';
import { MemberRoleBadge } from './MemberRoleBadge';

interface PendingApprovalsPanelProps {
  items: PendingApproval[];
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  className?: string;
}

const METHOD_LABELS: Record<PendingApproval['method'], string> = {
  invite: 'Convite',
  access_request: 'Solicitação de acesso',
};

export function PendingApprovalsPanel({
  items,
  isAdmin,
  onApprove,
  onReject,
  className,
}: PendingApprovalsPanelProps) {
  const confirm = useConfirm();

  const handleReject = async (item: PendingApproval) => {
    const ok = await confirm(buildRejectApprovalConfirm(item.name));
    if (ok) onReject(item.id);
  };

  if (items.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-doqyn-warning-border bg-doqyn-warning-bg/50 p-4', className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-doqyn-text">Aprovações pendentes</h3>
        <p className="text-xs text-doqyn-muted">
          Usuários aguardando aprovação antes de receber permissões.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="w-full min-w-[240px] max-w-[320px] flex-1 rounded-lg border border-doqyn-border bg-doqyn-surface p-3"
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-doqyn-warning-bg text-xs font-semibold text-doqyn-warning">
                {getInitials(item.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-doqyn-text">{item.name}</p>
                <p className="truncate text-xs text-doqyn-muted">{item.email}</p>
                {item.role && (
                  <div className="mt-1">
                    <MemberRoleBadge role={item.role as UserRole} />
                  </div>
                )}
                <p className="mt-1.5 text-[10px] text-doqyn-muted">
                  {METHOD_LABELS[item.method]} · {item.requestedAt}
                </p>
                <p className="text-[10px] text-doqyn-warning">Aguardando aprovação</p>
              </div>
            </div>
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={() => onApprove(item.id)} className="h-7 flex-1">
                  <Check className="h-3.5 w-3.5" />
                  Aprovar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleReject(item)}
                  className="h-7 flex-1 border-doqyn-border"
                >
                  <X className="h-3.5 w-3.5" />
                  Recusar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
