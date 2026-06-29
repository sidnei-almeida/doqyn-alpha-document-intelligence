import { AlertTriangle, CalendarClock, ClipboardList, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { AuditOverview } from '@/types/audit';

type AuditSummaryCardsProps = {
  overview: AuditOverview;
  loading?: boolean;
  showPending?: boolean;
};

const cards = [
  {
    key: 'pendingCount' as const,
    label: 'Pendências',
    icon: ClipboardList,
    accent: 'text-doqyn-warning',
    bg: 'bg-doqyn-warning-bg/40',
  },
  {
    key: 'todayEventsCount' as const,
    label: 'Eventos hoje',
    icon: CalendarClock,
    accent: 'text-doqyn-primary',
    bg: 'bg-doqyn-primary-soft/40',
  },
  {
    key: 'criticalEventsCount' as const,
    label: 'Ações críticas',
    icon: AlertTriangle,
    accent: 'text-doqyn-danger',
    bg: 'bg-doqyn-danger-bg/40',
  },
  {
    key: 'pendingUsersCount' as const,
    label: 'Usuários aguardando',
    icon: Users,
    accent: 'text-doqyn-warning',
    bg: 'bg-doqyn-warning-bg/40',
  },
];

export function AuditSummaryCards({ overview, loading, showPending = true }: AuditSummaryCardsProps) {
  const visibleCards = showPending ? cards : cards.filter((card) => !card.key.startsWith('pending'));

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {visibleCards.map(({ key, label, icon: Icon, accent, bg }) => (
        <Card key={key} className="border-doqyn-border bg-doqyn-surface/80">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', accent)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-doqyn-muted">{label}</p>
              <p className="text-2xl font-semibold tabular-nums text-doqyn-text">
                {loading ? '—' : overview[key]}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
