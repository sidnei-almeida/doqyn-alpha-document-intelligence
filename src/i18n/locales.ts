/**
 * Os idiomas que o DOQYN fala, e a diferença entre falar e oferecer.
 *
 * `status: 'ready'` é o que aparece no seletor. `status: 'draft'` existe no código, carrega
 * catálogo e pode ser testado por `?lang=`, mas ninguém o encontra sozinho — é o princípio P9
 * do plano: um idioma pela metade parece produto abandonado, enquanto um idioma ausente
 * parece produto que ainda não chegou. Promover é trocar uma palavra aqui.
 *
 * Idioma da interface não é o mesmo que país. Um brasileiro pode preferir o app em inglês sem
 * deixar de ter CPF, e é por isso que esta lista não consulta nada da conta além da preferência
 * declarada.
 */

export type SupportedLocale = 'pt-BR' | 'en-US' | 'es-419';

export type LocaleStatus = 'ready' | 'draft';

export type LocaleDefinition = {
  code: SupportedLocale;
  /** Nome do idioma no próprio idioma — é assim que se reconhece o seu numa lista. */
  nativeName: string;
  /**
   * Chave do nome do idioma no idioma da interface, para quem varre a lista sem achar o próprio.
   * O `nativeName` fica ao lado, literal, porque ele não se traduz por definição.
   */
  labelKey: string;
  /** Bandeira não identifica idioma (espanhol não é a Espanha); a sigla, sim. */
  short: string;
  status: LocaleStatus;
};

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

export const LOCALES: LocaleDefinition[] = [
  {
    code: 'pt-BR',
    nativeName: 'Português (Brasil)',
    labelKey: 'common:locale.ptBR',
    short: 'PT',
    status: 'ready',
  },
  {
    code: 'en-US',
    nativeName: 'English (US)',
    labelKey: 'common:locale.enUS',
    short: 'EN',
    status: 'draft',
  },
  {
    code: 'es-419',
    nativeName: 'Español (Latinoamérica)',
    labelKey: 'common:locale.es419',
    short: 'ES',
    status: 'draft',
  },
];

export const SUPPORTED_LOCALES: SupportedLocale[] = LOCALES.map((locale) => locale.code);

/** Os que o seletor oferece. Cresce conforme cada catálogo fecha. */
export const EXPOSED_LOCALES: SupportedLocale[] = LOCALES.filter(
  (locale) => locale.status === 'ready',
).map((locale) => locale.code);

export const LOCALE_STORAGE_KEY = 'doqyn-locale';

/** `og:locale` usa sublinhado, não hífen — e não conhece `es-419`. */
const OG_LOCALE: Record<SupportedLocale, string> = {
  'pt-BR': 'pt_BR',
  'en-US': 'en_US',
  'es-419': 'es_LA',
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

export function localeDefinition(locale: SupportedLocale): LocaleDefinition {
  return LOCALES.find((item) => item.code === locale) ?? LOCALES[0]!;
}

/**
 * Reduz qualquer etiqueta BCP-47 ao idioma que sabemos falar.
 *
 * O navegador manda `pt`, `pt-PT`, `es-MX`, `en-GB` — variantes que não temos catálogo para
 * distinguir. Cair na variante mais próxima é melhor do que cair no padrão: um mexicano lendo
 * `es-419` está em casa; lendo português, não.
 */
export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;
  const tag = value.trim().replace('_', '-');
  if (!tag) return null;
  if (isSupportedLocale(tag)) return tag;

  const primary = tag.split('-')[0]!.toLowerCase();
  if (primary === 'pt') return 'pt-BR';
  if (primary === 'en') return 'en-US';
  if (primary === 'es') return 'es-419';
  return null;
}

function localeFromQueryString(search: string): SupportedLocale | null {
  try {
    const requested = new URLSearchParams(search).get('lang');
    return normalizeLocale(requested);
  } catch {
    return null;
  }
}

export function getStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * A cadeia de resolução da tela, na ordem do plano: escolha explícita, depois o que o navegador
 * pede, depois português.
 *
 * `?lang=` vem antes de tudo e é o único caminho que aceita idioma em preparo — serve para
 * conferir a tradução em produção sem oferecê-la a ninguém. Fora dele, só idioma pronto entra:
 * um navegador em espanhol não deve puxar um catálogo pela metade sozinho.
 *
 * Falta aqui um degrau que ainda não existe: a preferência gravada no perfil, que só chega na
 * Fase 2 junto com `AuthUser.locale`. Até lá o `localStorage` é a memória possível.
 */
export function resolveInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const fromQuery = localeFromQueryString(window.location.search);
  if (fromQuery) return fromQuery;

  const stored = getStoredLocale();
  if (stored && EXPOSED_LOCALES.includes(stored)) return stored;

  const preferred = window.navigator.languages ?? [window.navigator.language];
  for (const candidate of preferred) {
    const normalized = normalizeLocale(candidate);
    if (normalized && EXPOSED_LOCALES.includes(normalized)) return normalized;
  }

  return DEFAULT_LOCALE;
}

/**
 * Espelha `applyTheme` de `src/lib/theme.ts`: o atributo no `<html>` é a verdade que o resto
 * do documento lê. Sem ele, leitor de tela pronuncia português com fonética inglesa e o
 * navegador oferece traduzir uma página que já está no idioma certo.
 */
export function applyLocale(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;

  const ogLocale = document.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
  if (ogLocale) ogLocale.content = OG_LOCALE[locale];
}
