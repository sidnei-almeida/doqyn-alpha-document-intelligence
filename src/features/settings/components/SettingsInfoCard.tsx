import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { SettingsStatusBadge } from './SettingsStatusBadge';

type SettingsInfoCardProps = {
  icon: string;
  title: string;
  description: string;
  /** ok = Ativo; pending = Em breve (cadeado). Pronto para uso futuro. */
  status?: 'ok' | 'pending' | 'neutral';
  /** Destaque leve para o item central/ativo da seção. */
  featured?: boolean;
  href?: string;
  /** Rótulo do link; padrão "Abrir" para manter posição/texto consistentes. */
  linkLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function SettingsInfoCard({
  icon,
  title,
  description,
  status = 'neutral',
  featured = false,
  href,
  linkLabel = 'Abrir',
  className,
  children,
}: SettingsInfoCardProps) {
  const showBadge = status === 'ok' || status === 'pending';

  return (
    <div
      className={cn(
        'settings-info-card',
        status === 'ok' && 'settings-info-card--ok',
        status === 'pending' && 'settings-info-card--pending',
        featured && 'settings-info-card--featured',
        className,
      )}
    >
      <div className="settings-info-card__top">
        <span className="settings-info-card__icon" aria-hidden>
          <Icon name={icon} size={ICON_SIZE.md} />
        </span>
        <div className="settings-info-card__heading">
          <p className="settings-info-card__title">{title}</p>
          {showBadge ? <SettingsStatusBadge status={status} /> : null}
        </div>
      </div>

      <p className="settings-info-card__description">{description}</p>
      {children}

      {href ? (
        <Link to={href} className="settings-info-card__action">
          <span>{linkLabel}</span>
          <Icon name="arrow_forward" size={14} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
