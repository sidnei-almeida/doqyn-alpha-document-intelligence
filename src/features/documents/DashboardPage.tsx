import { MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { MOCK_DOCUMENTS } from '@/features/documents/mock-data';
import { formatDate } from '@/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();

  const stats = [
    { label: 'Documentos', value: MOCK_DOCUMENTS.length, path: '/documents' },
    {
      label: 'Em análise',
      value: MOCK_DOCUMENTS.filter((d) => d.status === 'analyzing').length,
      path: '/upload',
    },
    {
      label: 'Aguardando revisão',
      value: MOCK_DOCUMENTS.filter(
        (d) => d.status === 'pending_review' || d.status === 'needs_review',
      ).length,
      path: '/versioning',
    },
    { label: 'Eventos de auditoria', value: 6, path: '/audit' },
  ];

  return (
    <div className="h-auto w-full space-y-6">
      <PageHeader
        eyebrow="Visão geral"
        title="Painel de controle"
        description="Gestão segura de documentos empresariais com rastreabilidade e governança."
      />

      <div className="grid w-full items-start gap-5 min-[1280px]:grid-cols-[320px_1fr]">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="cursor-pointer transition-colors hover:border-doqyn-border-strong"
              onClick={() => navigate(stat.path)}
            >
              <CardContent className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-doqyn-subtle">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-doqyn-text">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Documentos recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="mb-2 hidden grid-cols-[1fr_140px_160px_40px] items-center gap-3 border-b border-doqyn-border pb-2 sm:grid">
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-doqyn-muted">
                Documento
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-doqyn-muted">
                Status
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-doqyn-muted">
                Data
              </span>
              <span className="sr-only">Ações</span>
            </div>

            <div className="max-h-[420px] space-y-1 overflow-y-auto scrollbar-thin">
              {MOCK_DOCUMENTS.slice(0, 6).map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-4 py-3 transition-colors hover:bg-doqyn-hover sm:grid-cols-[1fr_140px_160px_40px] sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-doqyn-text">{doc.displayName}</p>
                    <p className="truncate text-xs text-doqyn-muted">{doc.documentType}</p>
                  </div>
                  <StatusPill status={doc.status} />
                  <span className="text-xs text-doqyn-muted">{formatDate(doc.createdAt)}</span>
                  <button
                    type="button"
                    className="hidden justify-self-end rounded p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text sm:flex"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
