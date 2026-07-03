import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { canViewDocumentTracking } from './utils/trackingAccess';
import { TrackingPage } from './TrackingPage';

export function TrackingRoute() {
  const { roles, user, isLoading, membership } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-doqyn-muted">
        Verificando permissões...
      </div>
    );
  }

  if (!canViewDocumentTracking(roles, user?.role, membership?.status)) {
    return <Navigate to="/upload" replace />;
  }

  return <TrackingPage />;
}
