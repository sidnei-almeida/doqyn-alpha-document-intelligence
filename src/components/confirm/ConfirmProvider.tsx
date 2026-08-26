import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ICON_SIZE } from '@/lib/iconDefaults';
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
  const textMatches = !requiresText || typedText.trim() === state.confirmationText?.trim();

  const variant = state.variant ?? 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state.open}
        onClose={() => close(false)}
        title={state.title}
        size="sm"
        // Nasce de dentro de outro modal e precisa passar por cima dele.
        layer="confirm"
        // Com palavra a digitar há dado em jogo: clicar fora não descarta em silêncio.
        dismissOnOverlay={!requiresText}
        footer={
          <>
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
          </>
        }
      >
        <div className="flex items-start gap-2.5">
          <Icon
            name="warning"
            size={ICON_SIZE.sm}
            className={cn(
              'mt-0.5 shrink-0',
              variant === 'danger' ? 'text-doqyn-danger' : 'text-doqyn-warning',
            )}
            aria-hidden
          />
          <p className="text-sm text-doqyn-muted">{state.description}</p>
        </div>

        {requiresText && (
          <div className="mt-4 space-y-2">
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
            />
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
