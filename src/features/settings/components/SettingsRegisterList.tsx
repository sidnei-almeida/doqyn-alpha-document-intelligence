import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

export type SettingsRegisterEntry = {
  icon: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

/**
 * Lista de registro das Configurações: um assunto por linha, separadas por fio.
 * Substitui a grade de cards — o que informa é o texto, e a caixa em volta não informava nada.
 */
export function SettingsRegisterList({
  entries,
  className,
}: {
  entries: SettingsRegisterEntry[];
  className?: string;
}) {
  return (
    <ul className={cn('settings-register', className)}>
      {entries.map((entry) => (
        <li key={entry.title} className="settings-register__row">
          <span className="settings-register__glyph" aria-hidden>
            <Icon name={entry.icon} size={ICON_SIZE.sm} />
          </span>
          <div className="settings-register__copy min-w-0">
            <p className="settings-register__title">{entry.title}</p>
            <p className="settings-register__description">{entry.description}</p>
          </div>
          {entry.href ? (
            <Link to={entry.href} className="settings-register__action">
              <span>{entry.linkLabel ?? 'Abrir'}</span>
              <Icon name="chevron_right" size={14} aria-hidden />
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
