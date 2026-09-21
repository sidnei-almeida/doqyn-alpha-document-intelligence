import { i18n } from './index';
import ptCommon from './catalog/pt-BR/common.json';

type PhraseParams = Record<string, string | number>;

const ptPlural = new Intl.PluralRules('pt-BR');

function lookup(path: string): string | undefined {
  let node: unknown = ptCommon;
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Frase de `common` no idioma ativo, com o `pt-BR` embutido como rede.
 *
 * Serve a módulo puro que roda na casca e também em teste Node, onde o i18next pode ainda não ter
 * inicializado e `t()` devolveria a chave crua. `common` já está no bundle principal, então a rede
 * não custa um byte a mais. O plural segue a convenção de sufixo do i18next (`_one` / `_other`).
 */
export function commonPhrase(key: string, params?: PhraseParams): string {
  const fullKey = `common:${key}`;
  if (i18n.isInitialized && i18n.exists(fullKey, params)) {
    return String(i18n.t(fullKey, params));
  }
  const count = params?.count;
  const template =
    (typeof count === 'number' ? lookup(`${key}_${ptPlural.select(count)}`) : undefined) ??
    lookup(key) ??
    key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? ''));
}
