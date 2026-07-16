import { Icon } from '@/components/ui/Icon';

export const HOME_TIP_STORAGE_KEY = 'doqyn.home.tip.dismissed';

type HomeTipCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
};

/** Card de dica dispensável na fileira de indicadores (persistido em localStorage). */
export function HomeTipCard({
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
}: HomeTipCardProps) {
  const dismiss = () => {
    localStorage.setItem(HOME_TIP_STORAGE_KEY, 'true');
    onDismiss();
  };

  return (
    <div className="relative flex min-h-[8.5rem] flex-col gap-1.5 rounded-xl border border-doqyn-border-subtle bg-doqyn-surface p-4">
      <button
        type="button"
        aria-label="Dispensar dica"
        onClick={dismiss}
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-doqyn-subtle transition-colors hover:bg-doqyn-surface-hover hover:text-doqyn-text"
      >
        <Icon name="close" size={14} />
      </button>
      <div className="flex items-center gap-2 text-doqyn-muted">
        <Icon name="workspace_premium" size={16} className="text-doqyn-primary" />
        <span className="type-label">Dica</span>
      </div>
      <p className="type-body font-medium text-doqyn-text">{title}</p>
      <p className="type-caption text-doqyn-subtle">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-auto self-start pt-1 font-display text-label font-medium text-doqyn-primary hover:underline"
      >
        {actionLabel}
      </button>
    </div>
  );
}
