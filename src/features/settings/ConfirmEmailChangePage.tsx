import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DoqynLogo } from '@/components/brand';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { ApiError } from '@/lib/apiErrors';
import { cn } from '@/lib/utils';
import { emailChangeApi, getEmailChangeErrorMessage } from '@/features/settings/api/emailChangeApi';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; currentEmail: string; newEmail: string }
  | { kind: 'error'; title: string; message: string }
  | { kind: 'success'; message: string };

export function ConfirmEmailChangePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!token) {
        setPageState({
          kind: 'error',
          title: 'Link inválido',
          message: 'O link de confirmação está incompleto.',
        });
        return;
      }

      try {
        const data = await emailChangeApi.preview(token);
        if (cancelled) return;
        setPageState({
          kind: 'ready',
          currentEmail: data.currentEmail,
          newEmail: data.newEmail,
        });
      } catch (error) {
        if (cancelled) return;
        setPageState({
          kind: 'error',
          title: 'Não foi possível validar o link',
          message: getEmailChangeErrorMessage(error),
        });
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleConfirm() {
    if (!token) return;
    setSubmitting(true);
    try {
      const result = await emailChangeApi.confirm(token);
      toast.success(result.message);
      setPageState({ kind: 'success', message: result.message });
      window.setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      setPageState({
        kind: 'error',
        title: 'Confirmação não concluída',
        message: getEmailChangeErrorMessage(error),
      });
      if (code) {
        toast.error(getEmailChangeErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-doqyn-bg">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <DoqynLogo className="h-7" />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-doqyn-border bg-doqyn-surface p-6 shadow-sm sm:p-8">
          {pageState.kind === 'loading' ? (
            <p className="text-sm text-doqyn-muted">Validando link…</p>
          ) : null}

          {pageState.kind === 'ready' ? (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold text-doqyn-text">Confirmar novo e-mail</h1>
                <p className="mt-2 text-sm text-doqyn-muted">
                  Você está alterando o e-mail da conta de{' '}
                  <strong>{pageState.currentEmail}</strong> para{' '}
                  <strong>{pageState.newEmail}</strong>.
                </p>
              </div>
              <Button className="w-full" onClick={() => void handleConfirm()} disabled={submitting}>
                {submitting ? 'Confirmando…' : 'Confirmar alteração'}
              </Button>
            </div>
          ) : null}

          {pageState.kind === 'success' ? (
            <div className="space-y-3">
              <h1 className="text-xl font-semibold text-doqyn-text">E-mail atualizado</h1>
              <p className="text-sm text-doqyn-muted">{pageState.message}</p>
              <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
                Ir para login
              </Button>
            </div>
          ) : null}

          {pageState.kind === 'error' ? (
            <div className="space-y-3">
              <h1 className="text-xl font-semibold text-doqyn-text">{pageState.title}</h1>
              <p className="text-sm text-doqyn-muted">{pageState.message}</p>
              <Link
                to="/login"
                className={cn(buttonVariants({ variant: 'secondary' }), 'w-full')}
              >
                Voltar ao login
              </Link>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
