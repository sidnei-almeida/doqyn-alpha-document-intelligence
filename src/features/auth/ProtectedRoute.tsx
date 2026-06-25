import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { usesKeycloakAuth, usesMockAuth } from '@/auth/authConfig';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, error, retryAuth, login } = useAuth();
  const location = useLocation();
  const skipLoginRedirect = usesKeycloakAuth() || usesMockAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-sm text-doqyn-muted">
        Verificando acesso...
      </div>
    );
  }

  if (error && usesKeycloakAuth()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-doqyn-bg px-6 text-center">
        <p className="max-w-md text-sm text-doqyn-muted">{error}</p>
        <button
          type="button"
          onClick={retryAuth}
          className="rounded-md bg-doqyn-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (skipLoginRedirect && usesKeycloakAuth()) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-doqyn-bg px-6 text-center">
          <p className="text-sm text-doqyn-muted">Redirecionando para login...</p>
          <button
            type="button"
            onClick={() => void login('', '')}
            className="rounded-md bg-doqyn-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Entrar
          </button>
        </div>
      );
    }

    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-sm text-doqyn-muted">
        Verificando acesso...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/upload" replace />;
  }

  if (usesKeycloakAuth()) {
    return <Navigate to="/upload" replace />;
  }

  return <Outlet />;
}
