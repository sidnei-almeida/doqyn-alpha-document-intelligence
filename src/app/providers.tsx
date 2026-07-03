import { QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '@/components/confirm/ConfirmProvider';
import { AppToaster } from '@/components/ui/AppToaster';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/auth/AuthProvider';
import { queryClient } from './queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfirmProvider>
          <AuthProvider>
            {children}
            <AppToaster />
          </AuthProvider>
        </ConfirmProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
