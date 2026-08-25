import { cn } from '@/lib/utils';

interface TabsProps {
  tabs: { id: string; label: string; badge?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Escolha de vista no topo de uma página — mesma gramática do
 * `SegmentedTextToggle`: sem cápsula, sem preenchimento, e o escolhido marca
 * com régua de acento embaixo.
 *
 * O fio de largura total saiu: as listas que vêm abaixo já abrem com o seu
 * próprio fio, e os dois juntos desenhavam uma linha dupla logo abaixo das
 * abas. A contagem ao lado do rótulo também perdeu a pílula — é número de
 * registro, então é monoespaçada e tabular, como todo número contável do
 * sistema.
 */
export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex h-9 items-stretch gap-1', className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-[4px] px-2.5 text-caption font-medium transition-colors duration-150',
              'after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:transition-colors after:duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30',
              isActive
                ? 'text-doqyn-text after:bg-doqyn-accent-active'
                : 'text-doqyn-muted after:bg-transparent hover:text-doqyn-text',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'register-label tabular-nums transition-colors duration-150',
                  isActive ? 'text-doqyn-warning' : 'text-doqyn-subtle',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
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
