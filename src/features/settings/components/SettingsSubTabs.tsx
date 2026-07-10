import { cn } from '@/lib/utils';

type SettingsSubTabsProps<T extends string> = {
  items: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
  className?: string;
};

export function SettingsSubTabs<T extends string>({
  items,
  active,
  onSelect,
  ariaLabel,
  className,
}: SettingsSubTabsProps<T>) {
  return (
    <div className={cn('settings-subtabs', className)}>
      <div className="settings-segmented-control" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(item.id)}
              className={cn(
                'settings-segmented-control__item',
                isActive && 'settings-segmented-control__item--active',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
