import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

type HomeStatCardProps = {
  icon: string;
  label: string;
  value: string;
  caption?: string;
  /** Fração 0–1 para a barra de progresso (ex.: uso de storage). */
  progress?: number;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'ok' | 'warn';
};

/** Card de indicador da home — ícone + valor grande + ação, estilo Drive. */
export function HomeStatCard({
  icon,
  label,
  value,
  caption,
  progress,
  actionLabel,
  onAction,
  tone = 'default',
}: HomeStatCardProps) {
  return (
    <div className="flex min-h-[8.5rem] flex-col gap-2 rounded-xl border border-doqyn-border-subtle bg-doqyn-surface p-4">
      <div className="flex items-center gap-2 text-doqyn-muted">
        <Icon name={icon} size={ICON_SIZE.sm} />
        <span className="type-label">{label}</span>
      </div>
      <p
        className={cn(
          'font-display text-[22px] font-medium leading-tight tracking-[-0.01em] text-doqyn-text',
          tone === 'ok' && 'text-doqyn-success',
          tone === 'warn' && 'text-doqyn-warning',
        )}
      >
        {value}
      </p>
      {typeof progress === 'number' && (
        <div className="h-1 overflow-hidden rounded-full bg-doqyn-card">
          <div
            className="h-full rounded-full bg-doqyn-primary"
            style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }}
          />
        </div>
      )}
      {caption && <p className="type-caption text-doqyn-subtle">{caption}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-auto self-start pt-1 font-display text-label font-medium text-doqyn-primary hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
