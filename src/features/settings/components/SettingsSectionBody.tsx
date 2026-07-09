import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsSectionBodyProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

/** Wrapper padronizado para o conteúdo de cada seção de configurações. */
export function SettingsSectionBody({ children, className, id }: SettingsSectionBodyProps) {
  return (
    <div id={id} className={cn('settings-section-body', className)}>
      {children}
    </div>
  );
}
