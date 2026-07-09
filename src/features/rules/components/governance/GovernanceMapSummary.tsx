import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

type GovernanceMapSummaryProps = {
  categoryCount: number;
  groupCount: number;
  connectionCount: number;
  isAdmin: boolean;
  className?: string;
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="governance-stat-card rounded-xl border border-doqyn-border-subtle bg-doqyn-surface px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-doqyn-subtle">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-doqyn-text">{value}</p>
    </div>
  );
}

/** Faixa de métricas e guia visual do mapa de governança. */
export function GovernanceMapSummary({
  categoryCount,
  groupCount,
  connectionCount,
  isAdmin,
  className,
}: GovernanceMapSummaryProps) {
  return (
    <div className={cn('governance-map-summary space-y-3', className)}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Categorias" value={categoryCount} />
        <StatCard label="Grupos" value={groupCount} />
        <StatCard label="Conexões" value={connectionCount} />
      </div>

      <div className="governance-map-guide rounded-xl border border-doqyn-border-subtle bg-doqyn-surface/80 px-3 py-2.5 sm:px-4">
        <p className="text-xs font-medium text-doqyn-text">Como funciona</p>
        <ul className="mt-2 grid gap-2 text-[11px] text-doqyn-muted sm:grid-cols-3">
          <li className="flex items-start gap-2">
            <Icon name="open_with" size={14} className="mt-0.5 shrink-0 text-doqyn-primary" aria-hidden />
            <span>
              {isAdmin ? 'Arraste do conector de uma categoria até um grupo para liberar acesso.' : 'Grupos definem quem pode acessar cada categoria.'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Icon name="swap_horiz" size={14} className="mt-0.5 shrink-0 text-doqyn-primary" aria-hidden />
            <span>Dê dois cliques em uma linha de conexão para ver ou ajustar permissões.</span>
          </li>
          <li className="flex items-start gap-2">
            <Icon name="account_tree" size={14} className="mt-0.5 shrink-0 text-doqyn-primary" aria-hidden />
            <span>Mova os cards livremente e use o ícone de ramo no grupo para conectar.</span>
          </li>
        </ul>
        {isAdmin && (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-doqyn-subtle">
            <Icon name="touch_app" size={12} aria-hidden />
            Alterações ficam pendentes até você salvar no topo do mapa.
          </p>
        )}
      </div>
    </div>
  );
}
