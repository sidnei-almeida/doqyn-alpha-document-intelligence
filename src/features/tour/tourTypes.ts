/** Quem pode ver o passo — mesmas perguntas que a Sidebar já faz para montar o menu. */
export type TourAccess = {
  /** `company_admin` — quem aprova acesso e mexe em usuários. */
  canManageUsers: boolean;
  /** Quem pode abrir Regras de acesso. */
  canAccessRules: boolean;
  /** Quem decide o que vale para a organização (admin de PJ, ou o dono em PF). */
  governsOrganization: boolean;
};

export type TourStep = {
  id: string;
  /** Chave do título do cartão, em `tour.json`. */
  titleKey: string;
  /** Chave do corpo do cartão — uma ou duas frases, sem lista. */
  bodyKey: string;
  /**
   * Rota a abrir antes de procurar o alvo. Sem rota, o passo acontece onde a
   * pessoa já está — é o caso dos que apontam para o rail e para a barra.
   */
  route?: string;
  /**
   * Alvo do holofote, em ordem de preferência: o primeiro que existir na tela
   * vence. Sem alvo (ou nenhum encontrado), o cartão nasce centralizado e a
   * tela inteira escurece.
   */
  target?: readonly string[];
  /** Folga entre o recorte e o elemento, em px. */
  padding?: number;
  /** Some do roteiro quando a resposta é `false`. */
  visible?: (access: TourAccess) => boolean;
};

export type TourCardPlacement = 'right' | 'left' | 'top' | 'bottom' | 'center';

export type TourRect = { top: number; left: number; width: number; height: number };
