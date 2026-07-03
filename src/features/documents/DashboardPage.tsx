import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { DocumentViewerModal } from '@/features/documents/viewer';
import { formatDate } from '@/lib/utils';
import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import type { DocumentListItem } from '@/types/document-library';
import type { DocumentStatus } from '@/types/document';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';

const PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: string }> = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function StatCard({
  label,
  value,
  subtext,
  onClick,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-colors hover:border-doqyn-border-strong' : undefined}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-doqyn-subtle">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-doqyn-text">{value}</p>
        {subtext && <p className="mt-1 text-xs text-doqyn-muted">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function DistributionList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-doqyn-muted">{emptyLabel}</p>
        ) : (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-doqyn-text">{item.label}</span>
                <span className="text-doqyn-muted">{item.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-doqyn-bg">
                <div
                  className="h-full rounded-full bg-doqyn-accent/70"
                  style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriodKey>('30d');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useDashboardOverview(period);

  const primaryCards = useMemo(() => {
    if (!data) return [];
    const { summary } = data;
    return [
      {
        label: 'Documentos',
        value: summary.totalDocuments,
        subtext: `+${summary.documentsUploadedInPeriod} nos últimos ${period === '7d' ? '7' : period === '90d' ? '90' : '30'} dias`,
        path: '/documents',
      },
      {
        label: 'Em análise',
        value: summary.documentsInAnalysis,
        subtext: 'processamento em andamento',
        path: '/upload',
      },
      {
        label: 'Aguardando revisão',
        value: summary.documentsAwaitingReview,
        subtext: 'confirmação manual',
        path: '/documents',
      },
      {
        label: 'Processados',
        value: summary.documentsProcessed,
        subtext: `${summary.previewReady} previews prontos`,
        path: '/documents',
      },
      {
        label: 'Erros',
        value: summary.documentsWithErrors,
        subtext: 'preview ou análise',
        path: '/audit',
      },
      {
        label: 'Eventos',
        value: summary.trackingEventsInPeriod,
        subtext: `${summary.viewsInPeriod} previews · ${summary.downloadsInPeriod} downloads`,
        path: '/tracking',
      },
    ];
  }, [data, period]);

  const openDocument = (doc: DocumentListItem) => {
    if (!doc.permissions?.canPreview) return;
    setSelectedDocId(doc.documentId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-doqyn-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando visão geral...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-doqyn-danger">Não foi possível carregar a visão geral agora.</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const isEmpty = data.summary.totalDocuments === 0;

  return (
    <PageShell
      eyebrow="Visão geral"
      title="Painel de controle"
      description={`${data.tenant.displayName} · dados reais do ambiente`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-doqyn-border p-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  period === option.key
                    ? 'bg-doqyn-accent text-white'
                    : 'text-doqyn-muted hover:text-doqyn-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button onClick={() => navigate('/upload')}>
            <Upload className="h-4 w-4" />
            Enviar documento
          </Button>
        </div>
      }
      bodyClassName="dashboard-page gap-4"
    >
      {isFetching && !isLoading && (
        <p className="shrink-0 text-xs text-doqyn-muted">Atualizando métricas...</p>
      )}

      <div className="shrink-0 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {primaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            subtext={card.subtext}
            onClick={() => navigate(card.path)}
          />
        ))}
      </div>

      <div className="shrink-0 grid gap-5 xl:grid-cols-3">
        <DistributionList
          title="Documentos por status"
          items={data.documentsByStatus.map((item) => ({
            label: item.label,
            count: item.count,
          }))}
          emptyLabel="Nenhum documento no período."
        />
        <DistributionList
          title="Documentos por categoria"
          items={data.documentsByCategory.map((item) => ({
            label: item.categoryName,
            count: item.count,
          }))}
          emptyLabel="Nenhuma categoria com documentos."
        />
        <Card>
          <CardHeader>
            <CardTitle>Saúde do ambiente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-doqyn-text">
              Storage: {data.health.hasStorageConfigured ? 'OK' : 'Pendente'}
            </p>
            <p className="text-doqyn-text">
              Categorias ativas: {data.health.hasActiveCategories ? 'OK' : 'Pendente'}
            </p>
            <p className="text-doqyn-text">
              Regras de IA: {data.health.hasActiveExtractionRules ? 'OK' : 'Pendente'}
            </p>
            {data.storage?.bucketNameMasked && (
              <p className="text-xs text-doqyn-muted">Bucket: {data.storage.bucketNameMasked}</p>
            )}
            {data.health.warnings.map((warning) => (
              <p key={warning} className="flex items-start gap-2 text-xs text-amber-400/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {warning}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="dashboard-main-grid grid min-h-[280px] flex-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="flex min-h-[280px] flex-col">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3">
            <CardTitle>Documentos recentes</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/documents')}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {isEmpty ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                <FileText className="h-8 w-8 text-doqyn-muted" />
                <p className="text-sm text-doqyn-muted">Nenhum documento enviado ainda.</p>
                <Button type="button" size="sm" onClick={() => navigate('/upload')}>
                  Enviar primeiro documento
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentDocuments.map((doc) => (
                  <div
                    key={doc.documentId}
                    className="grid grid-cols-1 gap-2 rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => openDocument(doc)}
                    >
                      <p className="truncate text-sm font-medium text-doqyn-text">
                        {doc.currentFileName ?? doc.displayName}
                      </p>
                      <p className="truncate text-xs text-doqyn-muted">
                        {doc.categoryName ?? doc.documentType ?? '—'} ·{' '}
                        {doc.createdBy?.displayName ?? doc.ownerName ?? '—'}
                      </p>
                    </button>
                    <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} />
                    <VersionBadge version={doc.versionLabel ?? `v${doc.version}`} isCurrent />
                    <div className="flex gap-1">
                      {doc.permissions?.canPreview && doc.latestVersionId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openDocument(doc)}
                          title="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {doc.permissions?.canViewTracking && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/tracking?documentId=${encodeURIComponent(doc.documentId)}`)
                          }
                          title="Tracking"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[280px] flex-col">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3">
            <CardTitle>Atividade recente</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/tracking')}>
              Ver tracking
            </Button>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-3">
            {data.recentTrackingEvents.length === 0 ? (
              <p className="flex flex-1 items-center text-sm text-doqyn-muted">
                Nenhuma atividade recente.
              </p>
            ) : (
              data.recentTrackingEvents.map((event) => (
                <div key={event.id} className="border-b border-doqyn-border-subtle pb-3 last:border-0">
                  <p className="text-sm text-doqyn-text">
                    <span className="font-medium">{event.actorName ?? 'Usuário'}</span>{' '}
                    {event.label.toLowerCase()}
                    {event.documentName ? (
                      <>
                        {' '}
                        <span className="text-doqyn-muted">· {event.documentName}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-doqyn-muted">{formatDate(event.occurredAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {data.mode === 'full' && data.governance && (
        <div className="grid min-h-[220px] flex-1 gap-5 xl:grid-cols-2">
          <Card className="flex min-h-[220px] flex-col">
            <CardHeader>
              <CardTitle>Governança documental</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Categorias" value={data.governance.documentCategories} />
              <StatCard label="Grupos" value={data.governance.documentGroups} />
              <StatCard label="Regras de extração" value={data.governance.activeExtractionRules} />
              <StatCard label="Regras de acesso" value={data.governance.activeAccessRules} />
              <StatCard label="Usuários ativos" value={data.governance.usersActive} />
              <StatCard
                label="Pendentes"
                value={data.governance.usersPending + data.governance.accessRequestsPending}
              />
            </CardContent>
          </Card>

          <Card className="flex min-h-[220px] flex-col">
            <CardHeader>
              <CardTitle>Storage e erros recentes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4">
              {data.storage && (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-doqyn-muted">Originais</dt>
                    <dd className="text-doqyn-text">{data.storage.originalFiles}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-doqyn-muted">Previews</dt>
                    <dd className="text-doqyn-text">{data.storage.previewFiles}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-doqyn-muted">Tamanho total</dt>
                    <dd className="text-doqyn-text">{formatBytes(data.storage.totalSizeBytes)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-doqyn-muted">Downloads no período</dt>
                    <dd className="flex items-center gap-1 text-doqyn-text">
                      <Download className="h-3.5 w-3.5" />
                      {data.summary.downloadsInPeriod}
                    </dd>
                  </div>
                </dl>
              )}
              {data.recentErrors.length > 0 ? (
                <div className="space-y-2">
                  {data.recentErrors.map((error) => (
                    <p key={error.id} className="text-xs text-doqyn-danger">
                      {error.documentName ?? 'Documento'} — {error.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-doqyn-muted">Nenhum erro recente no período.</p>
              )}
              {!data.health.hasActiveExtractionRules && (
                <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/rules')}>
                  Configurar regras
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <DocumentViewerModal
        open={Boolean(selectedDocId)}
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />
    </PageShell>
  );
}
