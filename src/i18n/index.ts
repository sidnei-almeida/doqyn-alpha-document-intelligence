/**
 * A instância única do i18next do front.
 *
 * Três decisões que valem explicação:
 *
 * **`common` entra no bundle, o resto vem por demanda.** `common` é o catálogo de fallback e o
 * único que toda tela usa; carregá-lo assíncrono adicionaria uma ida ao servidor antes do
 * primeiro pixel, para ganhar poucos quilobytes. Os namespaces de feature vão pelo caminho
 * oposto: `import.meta.glob` os transforma em chunks que o Vite entrega junto da rota que os
 * pede — o mesmo code-splitting que `lazyRoutes.tsx` já faz com os componentes.
 *
 * **Plural pelo `Intl.PluralRules`, não por ICU.** A regra de plural precisa morar no catálogo,
 * onde o tradutor a enxerga — nunca num ternário dentro do componente. O `i18next-icu` faz isso
 * com a sintaxe `{count, plural, ...}`, mas custava 27,8 kB gzip **no bundle inicial**, porque
 * arrasta o parser do `intl-messageformat`. O plural nativo do i18next resolve o mesmo problema
 * com sufixo de chave (`_one` / `_other`), delegando a categoria ao `Intl.PluralRules` do
 * próprio runtime — mesma correção em português, inglês e espanhol, sem um byte a mais.
 *
 * O que se perde é `select` e formato aninhado. Quando alguma tela precisar disso, o caminho é
 * carregar o ICU só para o namespace que o usa, não para todo mundo.
 *
 * **Chave faltando é ruído, não silêncio.** Em desenvolvimento avisa no console; em produção
 * cai no português e segue. O que nunca acontece é a chave crua aparecer na tela.
 */
import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptCommon from './catalog/pt-BR/common.json';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, applyLocale, resolveInitialLocale } from './locales';
import type { SupportedLocale } from './locales';

/** O Vite resolve isto em build: um chunk por arquivo de catálogo. */
const catalogLoaders = import.meta.glob<{ default: Record<string, unknown> }>('./catalog/*/*.json');

const DEFAULT_NAMESPACE = 'common';

/**
 * Namespace que não existe naquele idioma devolve objeto vazio em vez de erro. É o caso normal
 * durante a migração — a feature ainda não foi extraída, ou só o português já foi escrito — e
 * o `fallbackLng` resolve pedindo a mesma chave ao catálogo de referência.
 */
const lazyCatalogBackend = {
  type: 'backend' as const,
  init: () => {},
  read(
    language: string,
    namespace: string,
    callback: (error: Error | null, data: Record<string, unknown> | false) => void,
  ) {
    const loader = catalogLoaders[`./catalog/${language}/${namespace}.json`];
    if (!loader) {
      callback(null, {});
      return;
    }
    loader()
      .then((module) => callback(null, module.default))
      .catch((error: unknown) => callback(error as Error, false));
  },
};

let initialized = false;

export function initI18n(): I18nInstance {
  if (initialized) return i18next;
  initialized = true;

  const locale = resolveInitialLocale();

  void i18next
    .use(lazyCatalogBackend)
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      defaultNS: DEFAULT_NAMESPACE,
      ns: [DEFAULT_NAMESPACE],
      /* `common` já vem embutido; o backend cuida do resto. Sem isto o i18next
         ignoraria os recursos estáticos assim que um backend existe. */
      partialBundledLanguages: true,
      resources: {
        [DEFAULT_LOCALE]: { [DEFAULT_NAMESPACE]: ptCommon },
      },
      interpolation: { escapeValue: false },
      /* Suspense desligado de propósito: o provider fica acima do roteador, e uma suspensão
         ali derrubaria a casca inteira para carregar um catálogo de feature. Sem ele, a chave
         cai no fallback por um quadro e assenta — que é degradação, não tela em branco. */
      react: { useSuspense: false },
      saveMissing: import.meta.env.DEV,
      missingKeyHandler: (languages, namespace, key) => {
        if (!import.meta.env.DEV) return;
        console.warn(
          `[i18n] chave ausente: ${namespace}:${key} (${languages.join(', ')}) — caiu no ${DEFAULT_LOCALE}`,
        );
      },
      /**
       * Só chega aqui a chave que falta em **todos** os catálogos, inclusive no português —
       * ou seja, um erro de código, não um buraco de tradução. O buraco de tradução, que é o
       * estado normal durante a migração, o `fallbackLng` já resolve mostrando o português.
       *
       * Em desenvolvimento marca com cantoneiras para ser impossível não ver na tela. Em
       * produção devolve a chave mesmo: um texto inventado a partir do último segmento
       * pareceria funcionando e esconderia o defeito. O que impede isso de chegar em produção
       * é o portão de CI da Fase 13, não uma maquiagem aqui.
       */
      parseMissingKeyHandler: (key) => (import.meta.env.DEV ? `⟦${key}⟧` : key),
    });

  applyLocale(locale);
  i18next.on('languageChanged', (next) => {
    applyLocale(next as SupportedLocale);
  });

  return i18next;
}

export { i18next as i18n };
