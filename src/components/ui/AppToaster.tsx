import { Toaster } from 'sonner';
import { useTheme } from '@/contexts/useTheme';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      offset={20}
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
