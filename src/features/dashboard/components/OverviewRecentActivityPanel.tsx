import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { OverviewEmptyHint } from './OverviewEmptyHint';
import { OverviewPanelShell } from './OverviewPanelShell';
import { useTranslation } from 'react-i18next';

type TrackingEvent = {
  id: string;
  actorName?: string;
  label: string;
  documentName?: string;
  occurredAt: string;
};

/**
 * O que era uma timeline com bolinha e trilho virou log: quem, o quê, quando.
 * A bolinha desenhava uma linha do tempo que ninguém percorre — o que se lê
 * aqui é registro de acesso, e registro tem coluna de data em monoespaçado.
 */
export function ActivityLogRow({ actorName, label, documentName, occurredAt }: TrackingEvent) {
  return (
    <article className="overview-row py-2.5 pl-4 pr-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 flex-1 text-label leading-snug text-doqyn-text">
          <span className="font-medium">{actorName ?? 'Usuário'}</span>{' '}
          <span className="text-doqyn-muted">{label.toLowerCase()}</span>
        </p>
        <time className="overview-timestamp shrink-0 whitespace-nowrap">
          {formatDateTime(occurredAt)}
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

export function OverviewRecentActivityPanel({ events }: { events: TrackingEvent[] }) {
  const { t } = useTranslation('dashboard');

  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title={t('overviewRecentActivityPanel.atividadeRecente')}
      subtitle="Visualizações, downloads e rastreio"
      titleId="overview-recent-activity-title"
      actionLabel="Ver tracking"
      onAction={() => navigate('/tracking')}
      bodyClassName="flex-1"
      data-testid="overview-recent-activity"
    >
      {events.length === 0 ? (
        <OverviewEmptyHint
          icon="monitoring"
          title={t('overviewRecentActivityPanel.nenhumaAtividadeNoPeriodo')}
          description={t('overviewRecentActivityPanel.cadaAberturaDownloadE')}
        />
      ) : (
        <div className="flex flex-col">
          {events.map((event) => (
            <ActivityLogRow key={event.id} {...event} />
          ))}
        </div>
      )}
    </OverviewPanelShell>
  );
}
