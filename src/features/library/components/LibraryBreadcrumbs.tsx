import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { truncateBreadcrumbLabel } from '../utils/libraryItemActions';
import { ICON_SIZE } from '@/lib/iconDefaults';

type BreadcrumbSegment = {
  label: string;
  key: string;
  onClick?: () => void;
};

type LibraryBreadcrumbsProps = {
  segments: BreadcrumbSegment[];
  onNavigateRoot: () => void;
};

export function LibraryBreadcrumbs({ segments, onNavigateRoot }: LibraryBreadcrumbsProps) {
  const isAtRoot = segments.length === 0;

  return (
    <nav aria-label="Localização na Biblioteca" className="flex min-w-0 items-center gap-0.5 text-[12px]">
      <button
        type="button"
        onClick={onNavigateRoot}
        className={
          isAtRoot
            ? 'shrink-0 font-medium text-doqyn-text'
            : 'shrink-0 text-doqyn-muted transition-colors duration-[var(--transition-duration)] hover:text-doqyn-text'
        }
      >
        Biblioteca
      </button>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const label = truncateBreadcrumbLabel(segment.label);
        return (
          <span key={segment.key} className="flex min-w-0 items-center gap-1">
            <Icon name="chevron_right" size={ICON_SIZE.xs} className="shrink-0 text-doqyn-subtle" />
            {segment.onClick && !isLast ? (
              <Tooltip label={segment.label} wrapperClassName="min-w-0">
                <button
                  type="button"
                  onClick={segment.onClick}
                  className="truncate text-doqyn-muted transition-colors duration-[var(--transition-duration)] hover:text-doqyn-text"
                >
                  {label}
                </button>
              </Tooltip>
            ) : (
              <TruncatedText className="font-medium text-doqyn-text">{segment.label}</TruncatedText>
            )}
          </span>
        );
      })}
    </nav>
  );
}
