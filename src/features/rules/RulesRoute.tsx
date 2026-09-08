import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { canAccessRulesPage } from './utils/rulesAccess';
import { RulesPage } from './RulesPage';
import { useTranslation } from 'react-i18next';

export function RulesRoute() {
  const { t } = useTranslation('rules');

  const { hasAnyRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-doqyn-muted">
        {t('rulesRoute.verificandoPermissoes')}
      </div>
    );
  }

  if (!canAccessRulesPage(hasAnyRole)) {
    return <Navigate to="/biblioteca" replace />;
  }

  return <RulesPage />;
}
