/**
 * As palavras que mudam quando o tenant é pessoa física.
 *
 * Um texto neutro que servisse aos dois ("todo mundo do ambiente") é pior para os dois: em PJ
 * perde a precisão que "empresa" tem, e em PF nomeia uma coletividade que não existe. Então os
 * termos ficam aqui, num lugar só, e cada tela compõe a frase.
 *
 * Só entra aqui palavra que aparece em tela que **ambos** os tipos alcançam. Cadastro de empresa,
 * convite e fila de aprovação são de PJ por natureza e continuam dizendo "empresa" direto.
 */
export type TenantVocabulary = {
  /** O escopo que contém documentos: `empresa` · `conta`. */
  scope: string;
  /**
   * O escopo inteiro, com quantificador e artigo já dentro: `toda a organização` ·
   * `todo o seu acervo`. O gênero muda com a palavra, então "toda" não pode ficar na frase
   * que interpola — sairia "toda o seu acervo".
   */
  wholeScope: string;
  /** Posse: `da empresa` · `da sua conta`. */
  ofScope: string;
  /** Chave do rótulo da seção de Configurações que reúne o que vale para o tenant inteiro. */
  scopeSectionLabelKey: string;
};

const BUSINESS_VOCABULARY: TenantVocabulary = {
  scope: 'empresa',
  wholeScope: 'toda a organização',
  ofScope: 'da empresa',
  scopeSectionLabelKey: 'common:tenantVocabulary.scopeSectionLabelBusiness',
};

const INDIVIDUAL_VOCABULARY: TenantVocabulary = {
  scope: 'conta',
  wholeScope: 'todo o seu acervo',
  ofScope: 'da sua conta',
  scopeSectionLabelKey: 'common:tenantVocabulary.scopeSectionLabelIndividual',
};

export function isIndividualTenant(tenantType: string | null | undefined): boolean {
  return tenantType === 'individual';
}

export function tenantVocabulary(tenantType: string | null | undefined): TenantVocabulary {
  return isIndividualTenant(tenantType) ? INDIVIDUAL_VOCABULARY : BUSINESS_VOCABULARY;
}
