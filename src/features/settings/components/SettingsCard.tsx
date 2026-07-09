import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsCardProps = {
  children: ReactNode;
  className?: string;
  padding?: 'default' | 'none';
};

export function SettingsCard({ children, className, padding = 'default' }: SettingsCardProps) {
  return (
    <div
      className={cn(
        'settings-card',
        padding === 'default' && 'settings-card--padded',
        className,
      )}
    >
      {children}
    </div>
  );
}
