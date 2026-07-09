import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { PendingApproval } from '@/types/rules';

interface PendingApprovalsCardProps {
  items: PendingApproval[];
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const METHOD_LABELS: Record<PendingApproval['method'], string> = {
  invite: 'Convite',
  access_request: 'Solicitação de acesso',
};

export function PendingApprovalsCard({
  items,
  isAdmin,
  onApprove,
  onReject,
}: PendingApprovalsCardProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-doqyn-warning-border bg-doqyn-warning-bg/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Aprovações pendentes</CardTitle>
        <p className="text-xs text-doqyn-muted">
          Usuários aguardando aprovação antes de acessar documentos da empresa.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-doqyn-border bg-doqyn-bg/40 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-doqyn-text">{item.name}</p>
              <p className="text-xs text-doqyn-muted">{item.email}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-doqyn-muted">
                <span>Domínio: {item.domain}</span>
                <span>Solicitado em: {item.requestedAt}</span>
                <span>Método: {METHOD_LABELS[item.method]}</span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApprove(item.id)}
                  className="h-8"
                >
                  <Icon name="check" size={14} />
                  Aprovar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onReject(item.id)}
                  className="h-8 border-doqyn-border"
                >
                  <Icon name="close" size={14} />
                  Recusar
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
