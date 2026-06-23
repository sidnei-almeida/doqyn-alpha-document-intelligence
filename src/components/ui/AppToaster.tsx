import { Toaster } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
        },
      }}
    />
  );
}
