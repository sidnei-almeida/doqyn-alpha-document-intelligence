import { cn } from '@/lib/utils';
import type { AuditOverview } from '@/types/audit';
import { useTranslation } from 'react-i18next';

type AuditSummaryStripProps = {
  overview: AuditOverview;
  loading?: boolean;
  showPending?: boolean;
  /**
   * Para onde cada número leva.
   *
   * Sem isto, "5 ações críticas" em vermelho é um beco: o dado mais alarmante da tela não levava a
   * lugar nenhum, e quem quisesse ver as cinco tinha de adivinhar em qual aba procurar.
   */
  onSelect?: (tab: 'pending' | 'security' | 'events') => void;
};

/**
 * Os números da auditoria abrem a página como cabeçalho de registro: uma faixa
 * entre dois fios, colunas separadas por fio de 1px — sem cartão, sem ladrilho
 * de ícone.
 *
 * Eram quatro caixas com borda, canto arredondado e um ícone colorido em
 * quadrado ao lado de cada algarismo: quatro molduras e quatro ícones
 * decorativos disputando atenção com os quatro números, que são o conteúdo. O
 * tom agora vive no próprio algarismo, e só quando ele conta alguma coisa —
 * zero pendências não é alerta, então não pinta de laranja.
 */
const cards = [
  {
    key: 'pendingCount' as const,
    label: 'Pendências',
    tone: 'attention' as const,
    tab: 'pending' as const,
  },
  {
    key: 'todayEventsCount' as const,
    label: 'Eventos hoje',
    tone: 'default' as const,
    tab: 'events' as const,
  },
  {
    key: 'criticalEventsCount' as const,
    label: 'Ações críticas',
    tone: 'danger' as const,
    tab: 'security' as const,
  },
];

const TONE_CLASS = {
  default: 'text-doqyn-text',
  attention: 'text-doqyn-warning',
  danger: 'text-doqyn-danger',
} as const;

export function AuditSummaryStrip({
  overview,
  loading,
  showPending = true,
  onSelect,
}: AuditSummaryStripProps) {
  const { t } = useTranslation('audit');

  const visibleCards = showPending
    ? cards
    : cards.filter((card) => !card.key.startsWith('pending'));

  return (
    <section
      aria-label={t('auditSummaryStrip.resumoDaAuditoria')}
      className="grid gap-px border-y border-doqyn-border-subtle bg-doqyn-border-subtle/75 sm:grid-cols-2 xl:grid-cols-4"
    >
      {visibleCards.map(({ key, label, tone, tab }) => {
        const value = overview[key];
        // Zero não leva a lugar nenhum: abrir uma lista vazia responde menos que o próprio zero.
        const clicavel = Boolean(onSelect) && !loading && value > 0;

        const conteudo = (
          <>
            <span className="register-label text-doqyn-subtle">{label}</span>
            <span
              className={cn(
                'type-display tabular-nums',
                loading || value === 0 ? 'text-doqyn-text' : TONE_CLASS[tone],
                loading && 'text-doqyn-subtle',
              )}
            >
              {loading ? '—' : value}
            </span>
          </>
        );

        if (!clicavel) {
          return (
            <div key={key} className="flex flex-col gap-2 bg-doqyn-bg px-4 py-4">
              {conteudo}
            </div>
          );
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(tab)}
            className="flex flex-col gap-2 bg-doqyn-bg px-4 py-4 text-left transition-colors hover:bg-doqyn-card focus-visible:outline focus-visible:outline-1 focus-visible:outline-doqyn-accent-active"
            aria-label={`${label}: ${value}. Abrir lista.`}
          >
            {conteudo}
          </button>
        );
      })}
    </section>
  );
}
