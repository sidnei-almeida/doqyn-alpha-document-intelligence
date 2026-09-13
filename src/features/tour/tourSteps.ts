import type { TourAccess, TourStep } from './tourTypes';

/**
 * O roteiro do tour.
 *
 * Cada passo aponta para um elemento que já existe na tela — o holofote recorta
 * o elemento de verdade, não um desenho dele. Por isso os seletores preferem
 * âncoras que o app já tinha (`data-testid`, classes de layout) a atributos
 * criados só para o tour: menos coisa nova para alguém quebrar sem perceber.
 *
 * A ordem conta uma história: onde o documento entra, como ele se organiza, o
 * que se faz com ele, e só então quem pode o quê. Governança no fim de
 * propósito — antes disso a pessoa ainda não tem com o que se importar.
 *
 * O roteiro é constante de módulo, então guarda `titleKey` e `bodyKey`: o cartão resolve as
 * frases com o `t` da tela, e trocar de idioma com o tour aberto reescreve o passo em que a
 * pessoa está, em vez de deixá-la no idioma de quando o módulo carregou.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'boas-vindas',
    titleKey: 'tour:step.boas-vindas.title',
    bodyKey: 'tour:step.boas-vindas.body',
  },
  {
    id: 'biblioteca',
    titleKey: 'tour:step.biblioteca.title',
    bodyKey: 'tour:step.biblioteca.body',
    route: '/library',
    target: ['[data-tour="nav:/library"]'],
  },
  {
    id: 'enviar',
    titleKey: 'tour:step.enviar.title',
    bodyKey: 'tour:step.enviar.body',
    target: ['[data-tour="new-button"]'],
  },
  {
    id: 'classes',
    titleKey: 'tour:step.classes.title',
    bodyKey: 'tour:step.classes.body',
    route: '/library',
    target: [
      '[data-testid="explorer-folder-grid"]',
      '[data-testid="explorer-folder-grid-empty"]',
      '[data-testid="explorer-root-home"]',
    ],
  },
  {
    id: 'assinar',
    titleKey: 'tour:step.assinar.title',
    bodyKey: 'tour:step.assinar.body',
    target: ['[data-tour="nav:/library/signatures"]'],
  },
  {
    id: 'pedidos',
    titleKey: 'tour:step.pedidos.title',
    bodyKey: 'tour:step.pedidos.body',
    target: ['[data-tour="nav:/requests"]'],
  },
  {
    id: 'usuarios',
    titleKey: 'tour:step.usuarios.title',
    bodyKey: 'tour:step.usuarios.body',
    route: '/users',
    target: ['.page-shell__body'],
    visible: (access: TourAccess) => access.canManageUsers,
  },
  {
    id: 'regras',
    titleKey: 'tour:step.regras.title',
    bodyKey: 'tour:step.regras.body',
    route: '/rules',
    target: ['.page-shell__body'],
    visible: (access: TourAccess) => access.canAccessRules,
  },
  {
    id: 'matriz',
    titleKey: 'tour:step.matriz.title',
    bodyKey: 'tour:step.matriz.body',
    route: '/access-matrix',
    target: ['.matrix-grid', '.page-shell__body'],
  },
  {
    id: 'ia',
    titleKey: 'tour:step.ia.title',
    bodyKey: 'tour:step.ia.body',
    route: '/settings?section=organizacao',
    target: ['#upload', '.page-shell__body'],
    visible: (access: TourAccess) => access.governsOrganization,
  },
  {
    id: 'auditoria',
    titleKey: 'tour:step.auditoria.title',
    bodyKey: 'tour:step.auditoria.body',
    target: ['[data-tour="nav:/audit"]'],
  },
  {
    id: 'ajuda',
    titleKey: 'tour:step.ajuda.title',
    bodyKey: 'tour:step.ajuda.body',
    target: ['[data-tour="help"]'],
  },
];

/** O roteiro sem os passos que não pertencem a quem está olhando. */
export function visibleTourSteps(access: TourAccess): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.visible || step.visible(access));
}
