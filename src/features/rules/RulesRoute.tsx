import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { canAccessRulesPage } from './utils/rulesAccess';
import { RulesPage } from './RulesPage';

export function RulesRoute() {
  const { hasAnyRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-doqyn-muted">
        Verificando permissões...
      </div>
    );
  }

  if (!canAccessRulesPage(hasAnyRole)) {
    return <Navigate to="/biblioteca" replace />;
  }

  return <RulesPage />;
}
