import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

type SettingsInfoCardProps = {
  icon: string;
  title: string;
  description: string;
  status?: 'ok' | 'pending' | 'neutral';
  href?: string;
  linkLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function SettingsInfoCard({
  icon,
  title,
  description,
  status = 'neutral',
  href,
  linkLabel,
  className,
  children,
}: SettingsInfoCardProps) {
  return (
    <div className={cn('settings-info-card', className)}>
      <div className="flex items-start gap-3">
        <span className="settings-info-card__icon" aria-hidden>
          <Icon name={icon} size={ICON_SIZE.xs} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-doqyn-text">{title}</p>
            {status === 'ok' && (
              <span className="settings-health-badge settings-health-badge--ok">Ativo</span>
            )}
            {status === 'pending' && (
              <span className="settings-health-badge settings-health-badge--pending">Em breve</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-doqyn-muted">{description}</p>
          {children}
          {href && linkLabel && (
            <Link to={href} className="settings-link-action mt-2 inline-flex">
              {linkLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
