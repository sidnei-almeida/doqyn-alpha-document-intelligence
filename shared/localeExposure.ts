/**
 * Em que pé está cada idioma — a lista única, lida pelo front e pelo servidor (Fase 12 do
 * `.planning/I18N-PLANO.md`).
 *
 * `ready` é oferecido: aparece no seletor e o navegador de quem ainda não entrou pode cair nele.
 * `draft` tem catálogo e responde a quem pede explicitamente (`?lang=`, perfil), mas ninguém cai
 * nele sozinho — P9: idioma pela metade parece produto abandonado.
 *
 * Promover é trocar `draft` por `ready` **e** registrar `qaPassedAt`. O teste
 * `tests/i18n-locale-release.test.ts` recusa a promoção sem catálogo completo, com tradução
 * desatualizada (`npm run i18n:stale`) ou sem a data do roteiro de QA manual.
 *
 * Antes daqui o estado morava só em `src/i18n/locales.ts` e o servidor não sabia dele: o cartão
 * do link e o portal de assinatura respondiam em espanhol a qualquer navegador em espanhol.
 */
export type LocaleCode = 'pt-BR' | 'en-US' | 'es-419';

export type LocaleRelease = {
  status: 'ready' | 'draft';
  /** Dia (aaaa-mm-dd) em que o roteiro de QA manual daquele idioma passou. */
  qaPassedAt?: string;
};

export const LOCALE_RELEASE: Record<LocaleCode, LocaleRelease> = {
  'pt-BR': { status: 'ready' },
  'en-US': { status: 'draft' },
  'es-419': { status: 'draft' },
};

export function isExposedLocale(code: string): boolean {
  return LOCALE_RELEASE[code as LocaleCode]?.status === 'ready';
}
