import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { canViewDocumentTracking } from './utils/trackingAccess';
import { TrackingPage } from './TrackingPage';
import { useTranslation } from 'react-i18next';

export function TrackingRoute() {
  const { t } = useTranslation('tracking');

  const { roles, user, isLoading, membership } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-doqyn-muted">
        {t('trackingRoute.verificandoPermissoes')}
      </div>
    );
  }

  if (!canViewDocumentTracking(roles, user?.role, membership?.status)) {
    return <Navigate to="/biblioteca" replace />;
  }

  return <TrackingPage />;
}
