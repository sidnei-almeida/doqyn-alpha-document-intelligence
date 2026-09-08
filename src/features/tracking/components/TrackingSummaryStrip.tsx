import { cn } from '@/lib/utils';
import type { TrackingSummary } from '@/types/document-tracking';
import { useTranslation } from 'react-i18next';

type TrackingSummaryStripProps = {
  summary: TrackingSummary | undefined;
  loading?: boolean;
};

const TONE_CLASS = {
  default: 'text-doqyn-text',
  warning: 'text-doqyn-warning',
  danger: 'text-doqyn-danger',
} as const;

type StripEntry = {
  key: string;
  label: string;
  value: number;
  tone?: keyof typeof TONE_CLASS;
};

/**
 * Faixa de registro — mesma do resumo da Auditoria: colunas separadas por fio,
 * rótulo monoespaçado, algarismo grande. Eram sete cartões com borda e ladrilho
 * de ícone colorido: sete molduras e sete pictogramas competindo com os sete
 * números, que são o conteúdo. O tom colore o algarismo, e só quando ele conta
 * alguma coisa.
 */
export function TrackingSummaryStrip({ summary, loading = false }: TrackingSummaryStripProps) {
  const { t } = useTranslation('tracking');

  const entries: StripEntry[] = [
    { key: 'totalEvents', label: 'Eventos', value: summary?.totalEvents ?? 0 },
    { key: 'previews', label: 'Previews', value: summary?.previews ?? 0 },
    { key: 'downloads', label: 'Downloads', value: summary?.downloads ?? 0 },
    {
      key: 'accessDenied',
      label: 'Acesso negado',
      value: summary?.accessDenied ?? 0,
      tone: 'warning',
    },
    { key: 'errors', label: 'Erros', value: summary?.errors ?? 0, tone: 'danger' },
    { key: 'uniqueDocuments', label: 'Documentos', value: summary?.uniqueDocuments ?? 0 },
    { key: 'uniqueActors', label: 'Usuários ativos', value: summary?.uniqueActors ?? 0 },
  ];

  return (
    <section
      aria-label={t('trackingSummaryStrip.resumoDoTracking')}
      className="grid shrink-0 gap-px border-y border-doqyn-border-subtle bg-doqyn-border-subtle/75 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
    >
      {entries.map(({ key, label, value, tone = 'default' }) => (
        <div key={key} className="flex flex-col gap-1.5 bg-doqyn-bg px-4 py-3.5">
          <span className="register-label text-doqyn-subtle">{label}</span>
          <span
            className={cn(
              'type-display tabular-nums',
              loading ? 'text-doqyn-subtle' : value === 0 ? 'text-doqyn-text' : TONE_CLASS[tone],
            )}
          >
            {loading ? '—' : value}
          </span>
        </div>
      ))}
    </section>
  );
}
