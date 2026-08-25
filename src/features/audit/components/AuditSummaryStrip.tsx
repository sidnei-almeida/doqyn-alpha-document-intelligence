import { cn } from '@/lib/utils';
import type { AuditOverview } from '@/types/audit';

type AuditSummaryStripProps = {
  overview: AuditOverview;
  loading?: boolean;
  showPending?: boolean;
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
  { key: 'pendingCount' as const, label: 'Pendências', tone: 'attention' as const },
  { key: 'todayEventsCount' as const, label: 'Eventos hoje', tone: 'default' as const },
  { key: 'criticalEventsCount' as const, label: 'Ações críticas', tone: 'danger' as const },
  { key: 'pendingUsersCount' as const, label: 'Usuários aguardando', tone: 'attention' as const },
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
}: AuditSummaryStripProps) {
  const visibleCards = showPending
    ? cards
    : cards.filter((card) => !card.key.startsWith('pending'));

  return (
    <section
      aria-label="Resumo da auditoria"
      className="grid gap-px border-y border-doqyn-border-subtle bg-doqyn-border-subtle/75 sm:grid-cols-2 xl:grid-cols-4"
    >
      {visibleCards.map(({ key, label, tone }) => {
        const value = overview[key];
        return (
          <div key={key} className="flex flex-col gap-2 bg-doqyn-bg px-4 py-4">
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
          </div>
        );
      })}
    </section>
  );
}
