import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

type TrackingEvent = {
  id: string;
  actorName?: string;
  label: string;
  documentName?: string;
  occurredAt: string;
};

type HomeActivityPanelProps = {
  events: TrackingEvent[];
};

/** Feed de atividade do painel lateral — avatar + ação + documento + tempo relativo. */
export function HomeActivityPanel({ events }: HomeActivityPanelProps) {
  const navigate = useNavigate();

  return (
    <aside
      aria-label="Atividade recente"
      className="flex h-fit flex-col rounded-xl border border-doqyn-border-subtle bg-doqyn-surface"
    >
      <h2 className="type-h2 px-4 pb-1 pt-4">Atividade</h2>
      <div className="flex flex-col gap-1 px-2 py-2">
        {events.length === 0 && (
          <p className="type-caption px-2 py-3 text-doqyn-subtle">
            Nenhuma atividade recente por aqui.
          </p>
        )}
        {events.slice(0, 8).map((event) => (
          <article key={event.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
            <UserAvatar name={event.actorName ?? 'Usuário'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="type-body leading-snug text-doqyn-text">
                <span className="font-medium">{event.actorName ?? 'Usuário'}</span>{' '}
                <span className="text-doqyn-muted">{event.label.toLowerCase()}</span>
              </p>
              {event.documentName && (
                <TruncatedText as="p" className="type-caption mt-0.5 text-doqyn-subtle">
                  {event.documentName}
                </TruncatedText>
              )}
            </div>
            <time className="type-caption shrink-0 whitespace-nowrap pt-0.5 text-doqyn-subtle">
              {formatRelativeTime(event.occurredAt)}
            </time>
          </article>
        ))}
      </div>
      <div className="border-t border-doqyn-border-subtle p-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => navigate('/tracking')}
        >
          Ver toda a atividade
        </Button>
      </div>
    </aside>
  );
}
