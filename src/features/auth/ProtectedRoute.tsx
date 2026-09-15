import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useTranslation } from 'react-i18next';

export function ProtectedRoute() {
  const { t } = useTranslation('auth');

  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-sm text-doqyn-muted">
        {t('protectedRoute.verificandoAcesso')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { t } = useTranslation('auth');

  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-doqyn-bg text-sm text-doqyn-muted">
        {t('protectedRoute.verificandoAcesso2')}
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
