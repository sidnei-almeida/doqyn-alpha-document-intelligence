/**
 * As palavras que mudam quando o tenant é pessoa física.
 *
 * Um texto neutro que servisse aos dois ("todo mundo do ambiente") é pior para os dois: em PJ
 * perde a precisão que "empresa" tem, e em PF nomeia uma coletividade que não existe.
 *
 * Só entra aqui o que aparece em tela que **ambos** os tipos alcançam. Cadastro de empresa,
 * convite e fila de aprovação são de PJ por natureza e continuam dizendo "empresa" direto.
 *
 * O vocabulário guardava pedaços de frase em português — `toda a organização`, `da empresa` — que
 * cada tela interpolava. Isso só funciona em português: o pedaço concorda em gênero e posição com o
 * resto da frase, e em inglês "the company's documents" nem tem a mesma ordem. Agora cada frase
 * existe inteira no catálogo, uma por tipo, e o vocabulário só diz qual das duas usar.
 */
export type TenantVocabulary = {
  /** Qual variante de frase o catálogo deve usar. */
  variant: 'business' | 'individual';
  /** Chave do rótulo da seção de Configurações que reúne o que vale para o tenant inteiro. */
  scopeSectionLabelKey: string;
};

const BUSINESS_VOCABULARY: TenantVocabulary = {
  variant: 'business',
  scopeSectionLabelKey: 'common:tenantVocabulary.scopeSectionLabelBusiness',
};

const INDIVIDUAL_VOCABULARY: TenantVocabulary = {
  variant: 'individual',
  scopeSectionLabelKey: 'common:tenantVocabulary.scopeSectionLabelIndividual',
};

export function isIndividualTenant(tenantType: string | null | undefined): boolean {
  return tenantType === 'individual';
}

export function tenantVocabulary(tenantType: string | null | undefined): TenantVocabulary {
  return isIndividualTenant(tenantType) ? INDIVIDUAL_VOCABULARY : BUSINESS_VOCABULARY;
}
