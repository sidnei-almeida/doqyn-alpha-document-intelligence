import { toast } from 'sonner';
import { ApiError, isApiError } from '@/lib/apiErrors';
import { genericFailureMessage, getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';
import { sanitizeToastText } from '@/shared/feedback/appFeedbackSanitize';

export type AppToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type AppToastInput = {
  type: AppToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

/**
 * Nenhum aviso fica na tela para sempre — todo tipo tem teto.
 *
 * O tempo cresce com a gravidade porque o erro é o que precisa ser lido inteiro, e some por
 * último. O `loading` era `Infinity`: dependia de quem abriu lembrar de fechar, e qualquer
 * caminho de exceção que escapasse do `dismiss` deixava um "carregando" preso na tela até o
 * usuário recarregar a página. Sessenta segundos é teto de segurança, não expectativa de
 * duração: operação normal fecha o aviso muito antes, ao terminar.
 */
export const TOAST_DURATIONS: Record<AppToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 10000,
  loading: 60000,
};

export function showAppToast(input: AppToastInput): string | number {
  const title = sanitizeToastText(input.title);
  const description = input.message ? sanitizeToastText(input.message) : undefined;
  const duration = input.duration ?? TOAST_DURATIONS[input.type];
  const action = input.action
    ? { label: input.action.label, onClick: input.action.onClick }
    : undefined;

  switch (input.type) {
    case 'success':
      return toast.success(title, { description, duration, action });
    case 'error':
      return toast.error(title, { description, duration, action });
    case 'warning':
      return toast.warning(title, { description, duration, action });
    case 'info':
      return toast.info(title, { description, duration, action });
    case 'loading':
      return toast.loading(title, { description, duration });
    default:
      return toast.message(title, { description, duration, action });
  }
}

export function showApiErrorToast(error: unknown, fallbackMessage?: string): void {
  if (isApiError(error)) {
    /**
     * Pedir aprovação não é falhar.
     *
     * O servidor abre o pedido e devolve 409 — a ação não aconteceu, mas está a caminho de
     * alguém. Mostrar isso em vermelho, ao lado de "não foi possível", ensinaria que a
     * configuração do administrador é um defeito.
     */
    if (error.code === 'DOCUMENT_APPROVAL_REQUIRED') {
      showAppToast({ type: 'info', title: error.friendlyMessage });
      return;
    }

    showAppToast({
      type: 'error',
      title: error.friendlyMessage,
      message:
        import.meta.env.DEV && error.requestId
          ? `code: ${error.code} · requestId: ${error.requestId}`
          : undefined,
    });
    return;
  }

  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    showAppToast({
      type: 'error',
      title: getFriendlyAuthErrorMessage(code ?? 'UNKNOWN_ERROR', error.message),
    });
    return;
  }

  showAppToast({ type: 'error', title: fallbackMessage ?? genericFailureMessage() });
}

export function dismissAppToast(id?: string | number): void {
  if (id === undefined) {
    toast.dismiss();
    return;
  }
  toast.dismiss(id);
}

export { ApiError };
