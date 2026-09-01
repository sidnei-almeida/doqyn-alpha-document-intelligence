import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { isSidebarCollapsed, setSidebarCollapsed } from '@/components/layout/useSidebarCollapsed';
import { canAccessRulesPage } from '@/features/rules/utils/rulesAccess';
import { governsOrganization } from '@/features/settings/settingsSections';
import { TourContext, type TourContextValue } from './tourContext';
import { visibleTourSteps } from './tourSteps';
import { hasSeenTour, markTourSeen } from './tourStorage';

/**
 * Espera antes de abrir sozinho no primeiro acesso.
 *
 * Sem ela o tour nasce junto com a primeira pintura, sobre uma tela em que
 * ainda não há biblioteca nem sidebar medida — o holofote recortaria o lugar
 * errado e a pessoa veria o cartão pular.
 */
const FIRST_RUN_DELAY_MS = 900;

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, tenant, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  /** Como o rail estava antes do tour, para devolvê-lo no fim. */
  const collapsedBeforeTour = useRef(false);
  /** Onde a pessoa estava quando o tour começou. */
  const routeBeforeTour = useRef<string | null>(null);
  const autoStarted = useRef(false);

  const steps = useMemo(
    () =>
      visibleTourSteps({
        canManageUsers: hasAnyRole(['company_admin']),
        canAccessRules: canAccessRulesPage(hasAnyRole),
        governsOrganization: governsOrganization({
          tenantType: tenant?.tenantType,
          isCompanyAdmin: hasAnyRole(['company_admin']),
        }),
      }),
    [hasAnyRole, tenant?.tenantType],
  );

  const start = useCallback(() => {
    // Metade dos passos aponta para um item do rail, e no rail recolhido eles
    // são só um glifo: o cartão explicaria "Pedidos" apontando para um ícone
    // sem nome. Abrir o rail é parte do passo, não preferência do tour.
    collapsedBeforeTour.current = isSidebarCollapsed();
    if (collapsedBeforeTour.current) setSidebarCollapsed(false);
    routeBeforeTour.current = `${window.location.pathname}${window.location.search}`;
    setIndex(0);
    setOpen(true);
  }, []);

  /** Fim do tour, tanto pelo "Concluir" quanto pelo "Pular" e pelo Escape. */
  const stop = useCallback(() => {
    setOpen(false);
    markTourSeen(user?.id);
    if (collapsedBeforeTour.current) setSidebarCollapsed(true);
    // O tour navega por conta própria e terminava largando a pessoa na última
    // tela do roteiro — em Configurações, quase sempre. Volta para onde ela
    // estava: nada do que ela fazia antes foi pedido para ser interrompido.
    const origin = routeBeforeTour.current;
    routeBeforeTour.current = null;
    if (origin && origin !== `${window.location.pathname}${window.location.search}`) {
      navigate(origin);
    }
  }, [navigate, user?.id]);

  const next = useCallback(() => {
    // Fora do atualizador de estado de propósito: o último passo encerra o
    // tour, e encerrar mexe em `localStorage` e no rail. Efeito dentro de
    // atualizador roda duas vezes em modo estrito.
    if (index >= steps.length - 1) {
      stop();
      return;
    }
    setIndex(index + 1);
  }, [index, steps.length, stop]);

  const previous = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // Primeiro acesso: abre uma vez e nunca mais. Depois disso, só pelo "?".
  useEffect(() => {
    if (autoStarted.current || open) return;
    if (!user?.id || hasSeenTour(user.id)) return;

    const timer = window.setTimeout(() => {
      // A marca é feita aqui, e não antes de agendar: em modo estrito o efeito
      // roda duas vezes, e a limpeza da primeira passada cancela o timer. Marcar
      // cedo fazia a segunda passada desistir — e o tour não abria nunca.
      if (autoStarted.current) return;
      autoStarted.current = true;
      start();
    }, FIRST_RUN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [user?.id, open, start]);

  const step = open ? (steps[index] ?? null) : null;

  // Leva à rota do passo antes de procurar o alvo. A busca do elemento
  // (useTourTargetRect) já espera a rota carregar, então não há sincronia a
  // coordenar aqui além de não navegar para onde já se está.
  useEffect(() => {
    if (!step?.route) return;
    const [pathname, search = ''] = step.route.split('?');
    const samePath = location.pathname === pathname;
    const sameSearch = !search || location.search.replace(/^\?/, '') === search;
    if (samePath && sameSearch) return;
    navigate(step.route);
  }, [step, location.pathname, location.search, navigate]);

  const value: TourContextValue = useMemo(
    () => ({ open, steps, index, step, start, stop, next, previous }),
    [open, steps, index, step, start, stop, next, previous],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
