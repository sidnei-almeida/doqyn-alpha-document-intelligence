import { Icon } from '@/components/ui/Icon';
import { Card, CardContent } from '@/components/ui/Card';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { TrackingSummary } from '@/types/document-tracking';

type TrackingSummaryStripProps = {
  summary: TrackingSummary | undefined;
  loading?: boolean;
};

type SummaryCardProps = {
  label: string;
  value: number | string;
  icon: string;
  tone?: 'default' | 'warning' | 'danger';
  loading?: boolean;
};

const ICON_TONE_CLASS = {
  default: {
    box: 'bg-doqyn-primary-bg',
    icon: 'text-doqyn-primary',
  },
  warning: {
    box: 'bg-doqyn-warning-bg/70',
    icon: 'text-doqyn-warning',
  },
  danger: {
    box: 'bg-doqyn-danger-bg/70',
    icon: 'text-doqyn-danger',
  },
} as const;

const VALUE_TONE_CLASS = {
  default: 'text-doqyn-text',
  warning: 'text-doqyn-warning',
  danger: 'text-doqyn-danger',
} as const;

function SummaryCard({
  label,
  value,
  icon,
  tone = 'default',
  loading = false,
}: SummaryCardProps) {
  const iconTone = ICON_TONE_CLASS[tone];

  return (
    <Card className="border-doqyn-border-subtle bg-doqyn-surface/90 shadow-none">
      <CardContent className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            iconTone.box,
          )}
        >
          <Icon name={icon} size={ICON_SIZE.xs} className={iconTone.icon} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-doqyn-muted">{label}</p>
          <p className={cn('text-lg font-semibold tabular-nums', VALUE_TONE_CLASS[tone])}>
            {loading ? '…' : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrackingSummaryStrip({ summary, loading = false }: TrackingSummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
      <SummaryCard
        label="Eventos"
        value={summary?.totalEvents ?? 0}
        icon="description"
        loading={loading}
      />
      <SummaryCard
        label="Previews"
        value={summary?.previews ?? 0}
        icon="visibility"
        loading={loading}
      />
      <SummaryCard
        label="Downloads"
        value={summary?.downloads ?? 0}
        icon="download"
        loading={loading}
      />
      <SummaryCard
        label="Acesso negado"
        value={summary?.accessDenied ?? 0}
        icon="gpp_bad"
        tone="warning"
        loading={loading}
      />
      <SummaryCard
        label="Erros"
        value={summary?.errors ?? 0}
        icon="warning"
        tone="danger"
        loading={loading}
      />
      <SummaryCard
        label="Documentos"
        value={summary?.uniqueDocuments ?? 0}
        icon="description"
        loading={loading}
      />
      <SummaryCard
        label="Usuários ativos"
        value={summary?.uniqueActors ?? 0}
        icon="group"
        loading={loading}
      />
    </div>
  );
}
