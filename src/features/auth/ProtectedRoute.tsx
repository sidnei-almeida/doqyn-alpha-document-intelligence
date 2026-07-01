import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { usesMockAuth } from '@/auth/authConfig';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-sm text-doqyn-muted">
        Verificando acesso...
      </div>
    );
  }

  if (!isAuthenticated) {
    if (usesMockAuth()) {
      return <Navigate to="/login" replace state={{ from: location }} />;
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

  return <Outlet />;
}
