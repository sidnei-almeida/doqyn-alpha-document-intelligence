import { Toaster } from 'sonner';
import { useTheme } from '@/contexts/useTheme';
import { TOAST_DURATIONS } from '@/shared/feedback/appFeedback';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      offset={20}
      // Teto para quem chama `toast.*` do sonner direto, sem passar por `showAppToast`: o padrão
      // da biblioteca vale para todos os tipos igual, então fica no tempo do aviso — erro que
      // precise de mais tempo tem que vir por `showAppToast`, que dá 10s.
      duration={TOAST_DURATIONS.warning}
      closeButton={false}
      richColors={false}
      expand={false}
      visibleToasts={3}
      gap={10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'app-toast',
          title: 'app-toast__title',
          description: 'app-toast__description',
          actionButton: 'app-toast__action',
          cancelButton: 'app-toast__cancel',
        },
      }}
    />
  );
}
