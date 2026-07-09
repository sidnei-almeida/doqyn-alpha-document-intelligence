import { SegmentedIconToggle } from '@/components/ui/SegmentedIconToggle';
import type { LibraryViewMode } from '../types/library';

type ViewModeToggleProps = {
  value: LibraryViewMode;
  onChange: (mode: LibraryViewMode) => void;
};

const VIEW_OPTIONS = [
  { value: 'grid' as const, label: 'Visualização em grade', icon: 'grid_view' },
  { value: 'list' as const, label: 'Visualização em lista', icon: 'view_list' },
];

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <SegmentedIconToggle
      value={value}
      options={VIEW_OPTIONS}
      onChange={onChange}
      aria-label="Modo de visualização"
    />
  );
}
