import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsSectionHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function SettingsSectionHeader({
  title,
  description,
  actions,
  className,
}: SettingsSectionHeaderProps) {
  return (
    <div className={cn('settings-section-header', className)}>
      <div className="min-w-0 flex-1">
        <h2 className="settings-section-title">{title}</h2>
        {description && <p className="settings-section-subtitle">{description}</p>}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
