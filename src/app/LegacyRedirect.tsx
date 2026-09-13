import { Navigate, useLocation } from 'react-router-dom';
import { resolveLegacyPath } from './legacyRoutes';

/**
 * Rota antiga em português → a nova, com query e hash intactos.
 *
 * Em produção o nginx já devolveu 301 antes de o app carregar; isto cobre o servidor de
 * desenvolvimento e qualquer navegação interna que ainda aponte para o endereço velho.
 */
export function LegacyRedirect() {
  const location = useLocation();
  const target = resolveLegacyPath(location.pathname) ?? '/library';
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
