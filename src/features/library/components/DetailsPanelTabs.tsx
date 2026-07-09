import { cn } from '@/lib/utils';

export type DetailsPanelTab = 'details' | 'activity';

type DetailsPanelTabsProps = {
  active: DetailsPanelTab;
  onChange: (tab: DetailsPanelTab) => void;
};

export function DetailsPanelTabs({ active, onChange }: DetailsPanelTabsProps) {
  const tabClass = (isActive: boolean) =>
    cn(
      'border-b-2 px-1 pb-2 text-[12px] font-medium transition-colors',
      isActive
        ? 'border-doqyn-accent-active text-doqyn-text'
        : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
    );

  return (
    <div className="flex gap-4 border-b border-doqyn-border-subtle" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'details'}
        className={tabClass(active === 'details')}
        onClick={() => onChange('details')}
      >
        Detalhes
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'activity'}
        className={tabClass(active === 'activity')}
        onClick={() => onChange('activity')}
      >
        Atividade
      </button>
    </div>
  );
}
