import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsRowProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  control: ReactNode;
  className?: string;
  /** Quando true, a linha fica com opacidade reduzida (ex.: recurso em breve). */
  muted?: boolean;
};

/**
 * Linha de configuração reutilizável: label + descrição à esquerda, controle à direita.
 * Padrão Vercel / Linear / Notion settings.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  control,
  className,
  muted = false,
}: SettingsRowProps) {
  return (
    <div className={cn('settings-row', muted && 'settings-row--muted', className)}>
      <div className="settings-row__copy min-w-0 flex-1">
        <label htmlFor={htmlFor} className="settings-row__label">
          {label}
        </label>
        {description ? <p className="settings-row__description">{description}</p> : null}
      </div>
      <div className="settings-row__control shrink-0">{control}</div>
    </div>
  );
}

type SettingsRowListProps = {
  children: ReactNode;
  className?: string;
};

/** Agrupa SettingsRow com divisórias internas, dentro de um SettingsCard. */
export function SettingsRowList({ children, className }: SettingsRowListProps) {
  return <div className={cn('settings-row-list', className)}>{children}</div>;
}
