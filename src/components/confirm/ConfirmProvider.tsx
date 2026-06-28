import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { ConfirmContext } from './confirmContext';
import type { ConfirmOptions } from './confirmTypes';

type ConfirmState = ConfirmOptions & { open: boolean };

const defaultState: ConfirmState = {
  open: false,
  title: '',
  description: '',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>(defaultState);
  const [typedText, setTypedText] = useState('');
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setTypedText('');
      setState({ ...options, open: true });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState(defaultState);
    setTypedText('');
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const requiresText = Boolean(state.confirmationText);
  const textMatches =
    !requiresText || typedText.trim() === state.confirmationText?.trim();

  const variant = state.variant ?? 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  variant === 'danger' ? 'bg-doqyn-danger-bg' : 'bg-doqyn-warning-bg',
                )}
              >
                <AlertTriangle
                  className={cn(
                    'h-5 w-5',
                    variant === 'danger' ? 'text-doqyn-danger' : 'text-doqyn-warning',
                  )}
                />
              </div>
              <div>
                <h2 id="confirm-dialog-title" className="text-base font-semibold text-doqyn-text">
                  {state.title}
                </h2>
                <p className="mt-1 text-sm text-doqyn-muted">{state.description}</p>
              </div>
            </div>

            {requiresText && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-doqyn-muted">
                  Digite{' '}
                  <span className="font-mono font-medium text-doqyn-text">
                    {state.confirmationText}
                  </span>{' '}
                  para confirmar:
                </p>
                <Input
                  id="confirm-text-input"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder={state.confirmationText}
                  autoComplete="off"
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {state.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                type="button"
                variant={variant === 'danger' ? 'danger' : 'primary'}
                disabled={!textMatches}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
