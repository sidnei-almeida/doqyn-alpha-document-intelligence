import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsFieldGroupProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Bloco de configuração sempre visível — sem accordion. */
export function SettingsFieldGroup({
  title,
  description,
  children,
  className,
}: SettingsFieldGroupProps) {
  return (
    <section className={cn('settings-field-group', className)}>
      <header className="settings-field-group__header">
        <h3 className="settings-field-group__title">{title}</h3>
        {description ? <p className="settings-field-group__description">{description}</p> : null}
      </header>
      <div className="settings-field-group__body">{children}</div>
    </section>
  );
}
