import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'doqyn.sidebar.collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--workspace-sidebar-width',
      collapsed ? 'var(--workspace-sidebar-width-collapsed)' : 'var(--workspace-sidebar-width-expanded)',
    );
  }, [collapsed]);

  return { collapsed, setCollapsed, toggleCollapsed };
}
