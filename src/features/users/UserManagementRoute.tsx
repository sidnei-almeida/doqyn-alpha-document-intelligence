import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { UsersPage } from './UsersPage';

export function UserManagementRoute() {
  const { hasAnyRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-doqyn-muted">
        Verificando permissões...
      </div>
    );
  }

  if (!hasAnyRole(['doqyn_admin', 'company_admin'])) {
    return <Navigate to="/upload" replace />;
  }

  return <UsersPage />;
}
