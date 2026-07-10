import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsCardProps = {
  children: ReactNode;
  className?: string;
  padding?: 'default' | 'none';
  /** compact = largura contida; flush = sem padding (listas de SettingsRow). */
  density?: 'default' | 'compact' | 'flush';
};

export function SettingsCard({
  children,
  className,
  padding = 'default',
  density = 'default',
}: SettingsCardProps) {
  const resolvedPadding = density === 'flush' ? 'none' : padding;

  return (
    <div
      className={cn(
        'settings-card',
        resolvedPadding === 'default' && 'settings-card--padded',
        density === 'compact' && 'settings-card--compact',
        density === 'flush' && 'settings-card--flush',
        className,
      )}
    >
      {children}
    </div>
  );
}
