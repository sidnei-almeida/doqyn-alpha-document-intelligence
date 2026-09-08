import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { UsersPage } from './UsersPage';
import { useTranslation } from 'react-i18next';

export function UserManagementRoute() {
  const { t } = useTranslation('users');

  const { hasAnyRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-doqyn-muted">
        {t('userManagementRoute.verificandoPermissoes')}
      </div>
    );
  }

  if (!hasAnyRole(['company_admin'])) {
    return <Navigate to="/biblioteca" replace />;
  }

  return <UsersPage />;
}
