import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import { formatStorageBytes } from '@/features/dashboard/utils/buildOverviewMetrics';

/**
 * Bloco de armazenamento no rodapé da sidebar — uso real do tenant.
 * A barra mostra a fração de documentos processados (métrica real; não há cota de bytes).
 */
export function SidebarStoragePanel() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { data } = useDashboardOverview('30d', {
    staleTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  if (!data?.storage) return null;

  const total = data.summary.totalDocuments;
  const processed = data.summary.documentsProcessed;
  const processedRatio = total > 0 ? processed / total : 0;

  return (
    <div className="mx-2 mb-2 shrink-0 rounded-xl border border-doqyn-border-subtle bg-doqyn-surface p-3 shadow-elevation-1">
      <p className="type-label text-doqyn-muted">{t('storage')}</p>
      <p className="mt-1 font-display text-[15px] font-medium tracking-[-0.005em] text-doqyn-text">
        {formatStorageBytes(data.storage.totalSizeBytes)}
        <span className="ml-1 font-body text-[11px] font-normal text-doqyn-subtle">
          em {total} {total === 1 ? 'documento' : 'documentos'}
        </span>
      </p>
      {total > 0 && (
        <>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-doqyn-card">
            <div
              className="h-full rounded-full bg-doqyn-primary"
              style={{ width: `${Math.min(100, Math.max(2, processedRatio * 100))}%` }}
            />
          </div>
          <p className="type-caption mt-1 text-doqyn-subtle">
            {Math.round(processedRatio * 100)}% dos documentos processados
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => navigate('/library')}
        className="mt-2 font-display text-label font-medium text-doqyn-primary hover:underline"
      >
        {t('manage')}
      </button>
    </div>
  );
}
