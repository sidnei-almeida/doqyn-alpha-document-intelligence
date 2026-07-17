import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { AppToaster } from '@/components/ui/AppToaster';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/auth/AuthProvider';
import i18n from '@/i18n';
import { useDocumentLang } from '@/i18n/useDocumentLang';
import { queryClient } from './queryClient';

/** Runs the `<html lang>` sync hook inside the i18next provider subtree. */
function LangSync() {
  useDocumentLang();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ConfirmProvider>
            <AppErrorBoundary>
              <AuthProvider>
                <LangSync />
                {children}
                <AppToaster />
              </AuthProvider>
            </AppErrorBoundary>
          </ConfirmProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
