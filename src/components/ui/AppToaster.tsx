import { Toaster } from 'sonner';
import { useTheme } from '@/contexts/useTheme';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="top-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-lg !border !shadow-modal !bg-doqyn-surface !text-doqyn-text !font-sans',
          title: '!text-sm !font-medium !text-doqyn-text',
          description: '!text-xs !text-doqyn-muted',
          actionButton:
            '!bg-doqyn-primary-bg !text-doqyn-text !border !border-doqyn-border !text-xs',
          cancelButton: '!text-doqyn-muted !text-xs',
          closeButton:
            '!border-doqyn-border !bg-doqyn-card !text-doqyn-muted hover:!text-doqyn-text',
          success:
            '!border-doqyn-success-border !bg-doqyn-success-bg [&_[data-title]]:!text-doqyn-text',
          error:
            '!border-doqyn-danger-border !bg-doqyn-danger-bg [&_[data-title]]:!text-doqyn-text',
          warning:
            '!border-doqyn-warning-border !bg-doqyn-warning-bg [&_[data-title]]:!text-doqyn-text',
          info: '!border-doqyn-border !bg-doqyn-card [&_[data-title]]:!text-doqyn-text',
          loading: '!border-doqyn-border !bg-doqyn-card',
        },
        style: {
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        },
      }}
    />
  );
}
