import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ICON_SIZE } from '@/lib/iconDefaults';

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
            {this.props.fallbackTitle ?? 'Algo inesperado aconteceu'}
          </h1>
          <p className="mt-2 text-sm text-doqyn-muted">
            Recarregue a página para continuar. Se o problema persistir, entre em contato com o
            suporte.
          </p>
          <Button type="button" className="mt-5 w-full" onClick={this.handleRetry}>
            Recarregar
          </Button>
        </div>
      </div>
    );
  }
}
