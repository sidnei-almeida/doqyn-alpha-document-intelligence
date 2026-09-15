import { QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { AppToaster } from '@/components/ui/AppToaster';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/auth/AuthProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { LocaleSync } from '@/i18n/LocaleSync';
import { queryClient } from './queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <ConfirmProvider>
            <AppErrorBoundary>
              <AuthProvider>
                <LocaleSync />
                {children}
                <AppToaster />
              </AuthProvider>
            </AppErrorBoundary>
          </ConfirmProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
