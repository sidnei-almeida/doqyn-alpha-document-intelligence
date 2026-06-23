import { cn } from '@/lib/utils';

interface TabsProps {
  tabs: { id: string; label: string; badge?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-doqyn-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'border-doqyn-primary text-doqyn-text'
              : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
          )}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-doqyn-warning-bg px-1 text-[10px] font-semibold text-doqyn-warning">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-doqyn-text">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-doqyn-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
