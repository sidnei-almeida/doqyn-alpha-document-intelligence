import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { i18n } from '@/i18n';

/**
 * Fronteira de erro é componente de classe — é a única forma que o React oferece — e hook não
 * existe ali. Por isso `i18n.t` direto do módulo, em vez de `useTranslation`.
 *
 * O que se perde: esta tela não se re-renderiza sozinha ao trocar de idioma. É aceitável, e
 * quase teórico: ela só aparece depois de a árvore ter quebrado, e nesse estado o caminho é
 * recarregar a página — que é exatamente o que o botão faz.
 *
 * As frases moram em `common`, o único catálogo embutido no bundle. Estavam em `components`, que
 * carrega sob demanda: quando a árvore quebrava antes de alguma tela pedir esse catálogo, a
 * fronteira mostrava as chaves cruas (`appErrorBoundary.title`) no lugar do texto.
 */
type AppErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[AppErrorBoundary]', error, info.componentStack);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface p-6 text-center">
          <Icon name="error_outline" size={ICON_SIZE.nav} className="mx-auto text-doqyn-muted" />
          <h1 className="mt-4 text-base font-semibold text-doqyn-text">
            {this.props.fallbackTitle ?? i18n.t('common:appErrorBoundary.title')}
          </h1>
          <p className="mt-2 text-sm text-doqyn-muted">
            {i18n.t('common:appErrorBoundary.message')}
          </p>
          <Button type="button" className="mt-5 w-full" onClick={this.handleRetry}>
            {i18n.t('common:appErrorBoundary.reload')}
          </Button>
        </div>
      </div>
    );
  }
}
