import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { OverviewEmptyHint } from './OverviewEmptyHint';
import { OverviewPanelShell } from './OverviewPanelShell';

type TrackingEvent = {
  id: string;
  actorName?: string;
  label: string;
  documentName?: string;
  occurredAt: string;
};

export function ActivityTimelineItem({
  actorName,
  label,
  documentName,
  occurredAt,
}: TrackingEvent) {
  return (
    <article className="overview-activity-item relative pl-5">
      <span
        className="bg-doqyn-text/20 ring-doqyn-surface/80 absolute left-0 top-[0.4rem] h-2 w-2 rounded-full ring-2"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug text-doqyn-text">
          <span className="font-medium">{actorName ?? 'Usuário'}</span>{' '}
          <span className="text-doqyn-muted">{label.toLowerCase()}</span>
        </p>
        <time className="overview-timestamp shrink-0 whitespace-nowrap tabular-nums">
          {formatDate(occurredAt)}
        </time>
      </div>
      {documentName && (
        <TruncatedText as="p" className="overview-row-meta mt-1">
          {documentName}
        </TruncatedText>
      )}
    </article>
  );
}

type OverviewRecentActivityPanelProps = {
  events: TrackingEvent[];
};

export function OverviewRecentActivityPanel({ events }: OverviewRecentActivityPanelProps) {
  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title="Atividade recente"
      subtitle="Visualizações, downloads e rastreio"
      titleId="overview-recent-activity-title"
      actionLabel="Ver tracking"
      onAction={() => navigate('/tracking')}
      className="h-full min-h-[18rem]"
      bodyClassName="overview-panel-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-0 sm:px-5"
      data-testid="overview-recent-activity"
    >
      {events.length === 0 ? (
        <OverviewEmptyHint
          title="Nenhuma atividade recente"
          description="Eventos do período selecionado aparecem aqui."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <ActivityTimelineItem key={event.id} {...event} />
          ))}
        </div>
      )}
    </OverviewPanelShell>
  );
}
