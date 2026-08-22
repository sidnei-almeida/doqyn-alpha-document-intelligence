import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { DocumentTrackingDetail, TrackingListStatus } from '@/types/document-tracking';
import {
  formatSecurityContextDisplay,
  formatSessionOrigin,
  formatTrackingAction,
  formatTrackingStatus,
  sanitizeTrackingMetadata,
} from '../utils/trackingDisplay';

const SEVERITY_VARIANTS = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
  debug: 'default',
} as const;

const STATUS_VARIANTS: Record<TrackingListStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  success: 'success',
  failed: 'danger',
  denied: 'warning',
  pending: 'default',
};

type TrackingEventDetailsDrawerProps = {
  open: boolean;
  event: DocumentTrackingDetail | null;
  loading?: boolean;
  onClose: () => void;
  onFilterByUser?: (userId: string) => void;
  onFilterByRequestId?: (requestId: string) => void;
};

export function TrackingEventDetailsDrawer({
  open,
  event,
  loading = false,
  onClose,
  onFilterByUser,
  onFilterByRequestId,
}: TrackingEventDetailsDrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (keydownEvent: KeyboardEvent) => {
      if (keydownEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const safeMetadata = event ? sanitizeTrackingMetadata(event.metadata) : {};
  const securityContext = event?.securityContext ?? event?.security;
  const securityDisplay = formatSecurityContextDisplay(securityContext, event?.occurredAt);
  const security = securityContext ? sanitizeTrackingMetadata(securityContext) : {};

  return (
    <div
      ref={overlayRef}
      className="modal-overlay-scrim fixed inset-0 z-50 flex justify-end backdrop-blur-sm"
      onClick={(clickEvent) => {
        if (clickEvent.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-lg flex-col border-l border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-doqyn-text">Detalhes do evento</h2>
            <p className="mt-1 text-xs text-doqyn-muted">Rastreabilidade documental sanitizada</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={ICON_SIZE.xs} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-doqyn-muted">Carregando detalhes...</p>
          ) : !event ? (
            <p className="text-sm text-doqyn-muted">Evento não encontrado.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={SEVERITY_VARIANTS[event.severity] ?? 'default'}>
                  {event.severity}
                </Badge>
                {event.status && (
                  <Badge variant={STATUS_VARIANTS[event.status] ?? 'default'}>
                    {formatTrackingStatus(event.status)}
                  </Badge>
                )}
                <span className="text-doqyn-muted">{formatDate(event.occurredAt)}</span>
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Ação</p>
                <p className="font-medium text-doqyn-text">{formatTrackingAction(event.action)}</p>
                <p className="mt-1 font-mono text-[11px] text-doqyn-subtle">{event.action}</p>
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Resumo</p>
                <p className="text-doqyn-text">{event.summary}</p>
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Ator</p>
                <p className="text-doqyn-text">
                  {event.actor.displayName ?? event.actor.email ?? event.actor.userId}
                </p>
                {event.actor.email && (
                  <p className="text-xs text-doqyn-muted">{event.actor.email}</p>
                )}
                {onFilterByUser && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-auto px-0 text-xs text-doqyn-accent-active"
                    onClick={() => onFilterByUser(event.actor.userId)}
                  >
                    Filtrar por este usuário
                  </Button>
                )}
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Documento</p>
                <p className="break-words text-doqyn-text">{event.document.name}</p>
                {event.document.documentId && (
                  <>
                    <p className="mt-1 font-mono text-[11px] text-doqyn-subtle">
                      {event.document.documentId}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-xs text-doqyn-accent-active"
                        onClick={() =>
                          navigate(
                            `/tracking?documentId=${encodeURIComponent(event.document.documentId!)}`,
                          )
                        }
                      >
                        Ver timeline do documento
                      </Button>
                      {/* Investigar termina em "deixa eu ver esse documento": o atalho evita
                          copiar o nome e procurar na Biblioteca. */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-xs text-doqyn-info"
                        onClick={() =>
                          navigate(
                            `/biblioteca?preview=${encodeURIComponent(event.document.documentId!)}`,
                          )
                        }
                      >
                        Abrir documento
                      </Button>
                    </div>
                  </>
                )}
                {event.document.versionLabel && (
                  <p className="mt-1 text-xs text-doqyn-muted">
                    Versão: {event.document.versionLabel}
                  </p>
                )}
              </div>

              {event.versionId && (
                <div>
                  <p className="text-xs text-doqyn-muted">ID da versão</p>
                  <p className="font-mono text-xs text-doqyn-text">{event.versionId}</p>
                </div>
              )}

              {event.changes?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
                    Alterações
                  </p>
                  <div className="space-y-3">
                    {event.changes.map((change) => (
                      <div
                        key={change.field}
                        className="rounded-md border border-doqyn-border/60 bg-doqyn-bg/40 p-3"
                      >
                        <p className="font-medium text-doqyn-text">{change.field}</p>
                        <p className="mt-1 text-xs text-doqyn-muted">
                          <span className="text-doqyn-subtle">Antes:</span>{' '}
                          {String(change.before ?? '—')}
                        </p>
                        <p className="text-xs text-doqyn-muted">
                          <span className="text-doqyn-subtle">Depois:</span>{' '}
                          {String(change.after ?? '—')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(event.requestId || event.sessionHash || typeof event.durationMs === 'number') && (
                <div className="space-y-1 rounded-md border border-doqyn-border/50 bg-doqyn-bg/30 p-3 text-xs">
                  {event.requestId && (
                    <div className="flex items-center justify-between gap-2">
                      <span>requestId: {event.requestId}</span>
                      {onFilterByRequestId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-1 text-xs"
                          onClick={() => onFilterByRequestId(event.requestId!)}
                        >
                          Filtrar
                        </Button>
                      )}
                    </div>
                  )}
                  {event.sessionHash && <p>sessão: {formatSessionOrigin(event.sessionHash)}</p>}
                  {typeof event.durationMs === 'number' && <p>duração: {event.durationMs}ms</p>}
                </div>
              )}

              {securityDisplay ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
                    Contexto de acesso
                  </p>
                  <div className="space-y-1 rounded-md border border-doqyn-border/50 bg-doqyn-bg/30 p-3 text-xs text-doqyn-muted">
                    <p>
                      <span className="text-doqyn-subtle">Dispositivo:</span>{' '}
                      {securityDisplay.deviceLabel}
                    </p>
                    <p>
                      <span className="text-doqyn-subtle">Tipo:</span>{' '}
                      {securityDisplay.deviceTypeLabel}
                    </p>
                    <p>
                      <span className="text-doqyn-subtle">Local aproximado:</span>{' '}
                      {securityDisplay.locationLabel}
                    </p>
                    <p>
                      <span className="text-doqyn-subtle">IP:</span> {securityDisplay.ipLabel}
                    </p>
                    <p>
                      <span className="text-doqyn-subtle">Sessão:</span>{' '}
                      {securityDisplay.sessionLabel}
                    </p>
                    {securityDisplay.occurredAtLabel ? (
                      <p>
                        <span className="text-doqyn-subtle">Horário:</span>{' '}
                        {formatDate(securityDisplay.occurredAtLabel)}
                      </p>
                    ) : null}
                    {securityDisplay.isExternalGuest ? (
                      <p>
                        <span className="text-doqyn-subtle">Origem:</span> Convidado externo
                      </p>
                    ) : null}
                    {'permissionResult' in security && security.permissionResult != null ? (
                      <p>
                        <span className="text-doqyn-subtle">Permissão:</span>{' '}
                        {String(security.permissionResult)}
                      </p>
                    ) : null}
                    {'permissionReason' in security && security.permissionReason != null ? (
                      <p>
                        <span className="text-doqyn-subtle">Motivo:</span>{' '}
                        {String(security.permissionReason)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {Object.keys(safeMetadata).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
                    Metadados
                  </p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-doqyn-bg/50 p-3 text-[11px] text-doqyn-muted">
                    {JSON.stringify(safeMetadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
