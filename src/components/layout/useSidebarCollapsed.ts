import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'doqyn.sidebar.collapsed';

/**
 * Assinantes do estado, para que duas instâncias do hook não se contradigam.
 *
 * O estado vivia só dentro de quem chamou o hook. Enquanto a Sidebar era a
 * única a usá-lo isso bastava; o tour precisa abrir o rail antes de apontar
 * para um item dele, e um `localStorage.setItem` de fora não acordaria o
 * componente montado. O aviso em memória resolve sem subir o estado para um
 * contexto que só teria dois participantes.
 */
const listeners = new Set<(collapsed: boolean) => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Muda o estado de fora do componente — usado pelo tour ao entrar num passo do rail. */
export function setSidebarCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener(value));
}

export function isSidebarCollapsed(): boolean {
  return readStored();
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readStored);

  useEffect(() => {
    listeners.add(setCollapsedState);
    return () => {
      listeners.delete(setCollapsedState);
    };
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setSidebarCollapsed(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--workspace-sidebar-width',
      collapsed
        ? 'var(--workspace-sidebar-width-collapsed)'
        : 'var(--workspace-sidebar-width-expanded)',
    );
  }, [collapsed]);

  return { collapsed, setCollapsed, toggleCollapsed };
}
