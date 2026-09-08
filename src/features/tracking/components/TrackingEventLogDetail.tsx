import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/lib/utils';
import type { DocumentTrackingDetail } from '@/types/document-tracking';
import {
  formatSecurityContextDisplay,
  formatSessionOrigin,
  sanitizeTrackingMetadata,
} from '../utils/trackingDisplay';
import { useTranslation } from 'react-i18next';

type TrackingEventLogDetailProps = {
  event: DocumentTrackingDetail | null;
  loading?: boolean;
  onFilterByUser?: (userId: string) => void;
  onFilterByRequestId?: (requestId: string) => void;
};

/**
 * O que não cabe na linha, aberto embaixo dela: alterações, contexto de acesso
 * e o metadado cru.
 *
 * Era uma gaveta lateral que cobria metade da lista — justamente quando se está
 * comparando um evento com o anterior. Aqui o registro continua no lugar e o
 * detalhe entra como continuação da mesma linha.
 */
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="register-label text-doqyn-subtle">{label}</p>
      <p className="mt-0.5 break-words font-mono text-caption text-doqyn-text">{value}</p>
    </div>
  );
}

function LinkAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      className="text-caption text-doqyn-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
    >
      {label}
    </button>
  );
}

export function TrackingEventLogDetail({
  event,
  loading = false,
  onFilterByUser,
  onFilterByRequestId,
}: TrackingEventLogDetailProps) {
  const { t } = useTranslation('tracking');

  const navigate = useNavigate();

  if (loading) {
    return (
      <p className="px-3 py-4 text-caption text-doqyn-muted">
        {t('trackingEventLogDetail.carregandoDetalhes')}
      </p>
    );
  }

  if (!event) {
    return (
      <p className="px-3 py-4 text-caption text-doqyn-muted">
        {t('trackingEventLogDetail.eventoNaoEncontrado')}
      </p>
    );
  }

  const metadata = sanitizeTrackingMetadata(event.metadata);
  const securityContext = event.securityContext ?? event.security;
  const security = formatSecurityContextDisplay(securityContext, event.occurredAt);
  const rawSecurity = securityContext ? sanitizeTrackingMetadata(securityContext) : {};

  return (
    <div
      className="space-y-4 px-3 py-4"
      onClick={(clickEvent) => clickEvent.stopPropagation()}
      role="presentation"
    >
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailField label={t('trackingEventLogDetail.evento')} value={event.id} />
        <DetailField label={t('trackingEventLogDetail.acao')} value={event.action} />
        <DetailField
          label={t('trackingEventLogDetail.ator')}
          value={event.actor.email ?? event.actor.userId}
        />
        <DetailField
          label={t('trackingEventLogDetail.documento')}
          value={event.document.documentId ?? '—'}
        />
        {event.versionId ? (
          <DetailField label={t('trackingEventLogDetail.idDaVersao')} value={event.versionId} />
        ) : null}
        {event.requestId ? (
          <DetailField label={t('trackingEventLogDetail.request')} value={event.requestId} />
        ) : null}
        {typeof event.durationMs === 'number' ? (
          <DetailField
            label={t('trackingEventLogDetail.duracao')}
            value={`${event.durationMs} ms`}
          />
        ) : null}
        {event.sessionHash ? (
          <DetailField
            label={t('trackingEventLogDetail.sessao')}
            value={formatSessionOrigin(event.sessionHash)}
          />
        ) : null}
      </div>

      {event.description && event.description !== event.summary ? (
        <p className="text-caption text-doqyn-muted">{event.description}</p>
      ) : null}

      {security ? (
        <div>
          <p className="register-label mb-1.5 text-doqyn-subtle">
            {t('trackingEventLogDetail.contextoDeAcesso')}
          </p>
          <dl className="grid gap-x-8 gap-y-1 text-caption sm:grid-cols-2 xl:grid-cols-3">
            {[
              ['Dispositivo', security.deviceLabel],
              ['Tipo', security.deviceTypeLabel],
              ['Local aproximado', security.locationLabel],
              ['IP', security.ipLabel],
              ['Horário', formatDateTime(event.occurredAt)],
              security.isExternalGuest ? ['Origem', 'Convidado externo'] : null,
              'permissionResult' in rawSecurity && rawSecurity.permissionResult != null
                ? ['Permissão', String(rawSecurity.permissionResult)]
                : null,
              'permissionReason' in rawSecurity && rawSecurity.permissionReason != null
                ? ['Motivo', String(rawSecurity.permissionReason)]
                : null,
            ]
              .filter((row): row is [string, string] => Array.isArray(row))
              .map(([label, value]) => (
                <div key={label} className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-doqyn-subtle">{label}:</dt>
                  <dd className="min-w-0 truncate text-doqyn-text">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      ) : null}

      {event.changes?.length ? (
        <div>
          <p className="register-label mb-1.5 text-doqyn-subtle">
            {t('trackingEventLogDetail.alteracoes')} {event.changes.length}
          </p>
          <div className="border-t border-doqyn-border-subtle">
            {event.changes.map((change) => (
              <div
                key={change.field}
                className="grid gap-x-6 gap-y-0.5 border-b border-doqyn-border-subtle/60 py-1.5 text-caption sm:grid-cols-[minmax(8rem,14rem)_1fr_1fr]"
              >
                <span className="font-mono text-doqyn-text">{change.field}</span>
                <span className="truncate text-doqyn-muted">
                  <span className="text-doqyn-subtle">{t('trackingEventLogDetail.before')} </span>
                  {String(change.before ?? '—')}
                </span>
                <span className="truncate text-doqyn-muted">
                  <span className="text-doqyn-subtle">{t('trackingEventLogDetail.after')} </span>
                  {String(change.after ?? '—')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {Object.keys(metadata).length > 0 ? (
        <div>
          <p className="register-label mb-1.5 text-doqyn-subtle">
            {t('trackingEventLogDetail.metadados')}
          </p>
          <pre className="max-h-56 overflow-auto border-l-2 border-doqyn-border-subtle py-1 pl-3 font-mono text-micro leading-relaxed text-doqyn-muted">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-doqyn-border-subtle pt-3">
        {onFilterByUser && (
          <LinkAction
            label={t('trackingEventLogDetail.filtrarPorEsteUsuario')}
            onClick={() => onFilterByUser(event.actor.userId)}
          />
        )}
        {onFilterByRequestId && event.requestId && (
          <LinkAction
            label={t('trackingEventLogDetail.filtrarPorEsteRequest')}
            onClick={() => onFilterByRequestId(event.requestId!)}
          />
        )}
        {event.document.documentId && (
          <>
            <LinkAction
              label={t('trackingEventLogDetail.verTimelineDoDocumento')}
              onClick={() =>
                navigate(`/tracking?documentId=${encodeURIComponent(event.document.documentId!)}`)
              }
            />
            <LinkAction
              label={t('trackingEventLogDetail.abrirDocumento')}
              onClick={() =>
                navigate(`/biblioteca?preview=${encodeURIComponent(event.document.documentId!)}`)
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
