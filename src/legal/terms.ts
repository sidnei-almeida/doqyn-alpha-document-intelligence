/**
 * Os Termos e Condições de Uso: o que é dado, e o que é texto.
 *
 * Versão, data de vigência e rota são dado — entram no registro de aceite e viajam para o
 * auth-service, então não mudam com o idioma da interface. O texto vive em `legal.json`.
 *
 * Namespace próprio, e não `pages`, de propósito: texto jurídico não se traduz junto com o resto
 * da tela. Ele exige revisão de quem responde por ele em cada jurisdição, e um arquivo separado é
 * o que torna esse portão visível — quem traduzir `pages.json` não arrasta os termos junto.
 */
import { i18n } from '@/i18n';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/i18n/locales';

export const DOQYN_TERMS_VERSION = 'v1.0-dev';

/**
 * Em que idioma a pessoa leu os termos que está aceitando — vai junto da versão.
 *
 * Termos traduzidos não são o mesmo documento: a redação muda por jurisdição, e provar
 * consentimento exige saber qual texto foi lido, não só qual número ele tinha. O idioma é o da
 * tela no instante do envio, que é o mesmo em que `/terms` e a caixa de aceite foram mostrados.
 */
export function acceptedTermsLocale(): SupportedLocale {
  return normalizeLocale(i18n.language) ?? DEFAULT_LOCALE;
}
export const DOQYN_TERMS_EFFECTIVE_DATE = '2026-07-02';
export const DOQYN_TERMS_ROUTE = '/terms';

export const DOQYN_PRIVACY_VERSION = 'v1.0-dev';
export const DOQYN_PRIVACY_ROUTE = '/privacy';

export const TERMS_LEGAL_NOTICE_KEY = 'legal:notice';

export type TermsSection = {
  id: string;
  titleKey: string;
  /** Uma chave por parágrafo: o tradutor vê cada um inteiro, e a contagem fica no código. */
  paragraphKeys: readonly string[];
};

export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    id: 'about',
    titleKey: 'legal:section.about.title',
    paragraphKeys: ['legal:section.about.p1', 'legal:section.about.p2'],
  },
  {
    id: 'eligibility',
    titleKey: 'legal:section.eligibility.title',
    paragraphKeys: ['legal:section.eligibility.p1', 'legal:section.eligibility.p2'],
  },
  {
    id: 'company-access',
    titleKey: 'legal:section.company-access.title',
    paragraphKeys: ['legal:section.company-access.p1', 'legal:section.company-access.p2'],
  },
  {
    id: 'individual',
    titleKey: 'legal:section.individual.title',
    paragraphKeys: ['legal:section.individual.p1', 'legal:section.individual.p2'],
  },
  {
    id: 'documents',
    titleKey: 'legal:section.documents.title',
    paragraphKeys: ['legal:section.documents.p1', 'legal:section.documents.p2'],
  },
  {
    id: 'ai',
    titleKey: 'legal:section.ai.title',
    paragraphKeys: ['legal:section.ai.p1', 'legal:section.ai.p2'],
  },
  {
    id: 'governance',
    titleKey: 'legal:section.governance.title',
    paragraphKeys: ['legal:section.governance.p1', 'legal:section.governance.p2'],
  },
  {
    id: 'responsibility',
    titleKey: 'legal:section.responsibility.title',
    paragraphKeys: ['legal:section.responsibility.p1', 'legal:section.responsibility.p2'],
  },
  {
    id: 'security',
    titleKey: 'legal:section.security.title',
    paragraphKeys: ['legal:section.security.p1', 'legal:section.security.p2'],
  },
  {
    id: 'limitations',
    titleKey: 'legal:section.limitations.title',
    paragraphKeys: ['legal:section.limitations.p1', 'legal:section.limitations.p2'],
  },
  {
    id: 'suspension',
    titleKey: 'legal:section.suspension.title',
    paragraphKeys: ['legal:section.suspension.p1', 'legal:section.suspension.p2'],
  },
  {
    id: 'audit',
    titleKey: 'legal:section.audit.title',
    paragraphKeys: ['legal:section.audit.p1', 'legal:section.audit.p2'],
  },
  {
    id: 'changes',
    titleKey: 'legal:section.changes.title',
    paragraphKeys: ['legal:section.changes.p1', 'legal:section.changes.p2'],
  },
  {
    id: 'contact',
    titleKey: 'legal:section.contact.title',
    paragraphKeys: ['legal:section.contact.p1'],
  },
];
