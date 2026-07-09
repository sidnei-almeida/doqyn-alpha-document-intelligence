import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';

type SidebarTooltipProps = {
  label: string;
  collapsed: boolean;
  children: ReactNode;
};

/** Tooltip lateral exibido apenas com a sidebar colapsada (modo ícones). */
export function SidebarTooltip({ label, collapsed, children }: SidebarTooltipProps) {
  if (!collapsed) return children;

  return (
    <Tooltip label={label} placement="right" wrapperClassName="flex w-full justify-center">
      {children}
    </Tooltip>
  );
}
