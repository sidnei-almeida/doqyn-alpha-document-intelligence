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
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'boas-vindas',
    title: 'Onde fica cada coisa',
    body: 'Dois minutos percorrendo o essencial do DOQYN. Dá para sair a qualquer momento — o tour volta pelo ? na barra de cima.',
  },
  {
    id: 'biblioteca',
    title: 'Biblioteca',
    body: 'Todo documento que entra no DOQYN mora aqui. É a tela em que você navega, busca e abre — o resto do menu são recortes dela.',
    route: '/biblioteca',
    target: ['[data-tour="nav:/biblioteca"]'],
  },
  {
    id: 'enviar',
    title: 'Enviar documento',
    body: 'Por aqui, ou arrastando o arquivo para qualquer ponto da tela. A IA lê o documento, reconhece o que ele é e propõe nome, classe e metadados antes de você confirmar.',
    target: ['[data-tour="new-button"]'],
  },
  {
    id: 'classes',
    title: 'As pastas são classes',
    body: 'Cada pasta é uma classe de documento — contrato, nota fiscal, procuração. O documento cai na classe porque a IA reconheceu o que ele é, não porque alguém o arrastou até lá.',
    route: '/biblioteca',
    target: [
      '[data-testid="explorer-folder-grid"]',
      '[data-testid="explorer-folder-grid-empty"]',
      '[data-testid="explorer-root-home"]',
    ],
  },
  {
    id: 'assinar',
    title: 'Para assinar',
    body: 'O que espera a sua assinatura fica separado do resto. Você assina dentro do DOQYN, e quem é de fora assina por um link, sem precisar de conta.',
    target: ['[data-tour="nav:/biblioteca/assinaturas"]'],
  },
  {
    id: 'pedidos',
    title: 'Pedidos',
    body: 'Quando falta um documento, você pede em vez de esperar. O pedido acompanha quem já enviou e quem ainda não — e vira documento na Biblioteca assim que chega.',
    target: ['[data-tour="nav:/pedidos"]'],
  },
  {
    id: 'usuarios',
    title: 'Usuários e grupos',
    body: 'Quem entra na organização e em que grupo cai. O grupo é o que a governança enxerga: o acesso se dá ao grupo, nunca à pessoa solta.',
    route: '/users',
    target: ['.page-shell__body'],
    visible: (access: TourAccess) => access.canManageUsers,
  },
  {
    id: 'regras',
    title: 'Regras de acesso',
    body: 'É aqui que o acesso é escrito: ligue um grupo a uma classe e escolha os verbos — ver, baixar, enviar. Baixar aceita o meio-termo de pedir aprovação; os outros são sim ou não.',
    route: '/rules',
    target: ['.page-shell__body'],
    visible: (access: TourAccess) => access.canAccessRules,
  },
  {
    id: 'matriz',
    title: 'Matriz',
    body: 'A leitura do que as regras produziram: por pessoa, quem alcança cada documento; por grupo, o que cada um recebe, verbo a verbo. A matriz não altera nada — ela existe para conferir antes de descobrir pelo caminho errado.',
    route: '/matriz',
    target: ['.matrix-grid', '.page-shell__body'],
  },
  {
    id: 'ia',
    title: 'O quanto a IA decide',
    body: 'A política de envio e leitura automática vale para a organização inteira: até onde a IA classifica sozinha e quando ela devolve o documento para revisão humana.',
    route: '/settings?section=organizacao',
    target: ['#upload', '.page-shell__body'],
    visible: (access: TourAccess) => access.governsOrganization,
  },
  {
    id: 'auditoria',
    title: 'Auditoria',
    body: 'Toda ação sobre um documento vira registro: quem viu, quem baixou, quem assinou, quando. É o que sustenta a palavra do sistema quando alguém pergunta depois.',
    target: ['[data-tour="nav:/audit"]'],
  },
  {
    id: 'ajuda',
    title: 'O tour mora aqui',
    body: 'Sempre que precisar, este ? traz o passeio de volta — do começo, na tela em que você estiver.',
    target: ['[data-tour="help"]'],
  },
];

/** O roteiro sem os passos que não pertencem a quem está olhando. */
export function visibleTourSteps(access: TourAccess): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.visible || step.visible(access));
}
