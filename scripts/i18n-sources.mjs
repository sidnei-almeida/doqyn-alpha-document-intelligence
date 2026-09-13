/**
 * Contra qual frase em português cada tradução foi escrita (Fase 11.3 do `.planning/I18N-PLANO.md`).
 *
 * O plano previa gravar `_src` e `_status` dentro do próprio catálogo. Não gravamos: o catálogo é
 * o JSON que o i18next lê e que os scripts de i18n percorrem como frase, e um objeto no lugar da
 * frase quebraria os dois. O registro mora ao lado, em `src/i18n/translation-sources.json`.
 *
 * Quando a frase em português muda, o hash registrado deixa de bater e a tradução fica
 * desatualizada. Sem isso, ajuste de cópia em português deixa inglês e espanhol dizendo o que o
 * produto não faz mais — e nada quebra, então ninguém descobre.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');

export const CATALOG_ROOT = process.env.I18N_CATALOG_ROOT ?? resolve(REPO, 'src/i18n/catalog');
export const SOURCES_PATH =
  process.env.I18N_SOURCES_PATH ?? resolve(REPO, 'src/i18n/translation-sources.json');
export const REFERENCE = 'pt-BR';
export const TARGETS = ['en-US', 'es-419'];

export function sourceHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 10);
}

/** Folhas de um catálogo como pares `[chave.pontuada, frase]`. */
export function flatten(node, prefix = '') {
  if (typeof node === 'string') return [[prefix, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

export function listNamespaces(root = CATALOG_ROOT) {
  return readdirSync(resolve(root, REFERENCE))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

export function loadCatalog(locale, namespace, root = CATALOG_ROOT) {
  const file = resolve(root, locale, `${namespace}.json`);
  return existsSync(file) ? new Map(flatten(JSON.parse(readFileSync(file, 'utf8')))) : new Map();
}

/**
 * A frase em português de onde uma chave traduzida saiu.
 *
 * Plural é por folha: o `_one` do inglês responde ao `_one` do português. Categoria que o
 * português não tem — o `many` do espanhol — responde ao `_other`, que é de onde foi escrita.
 */
export function referenceText(reference, key) {
  if (reference.has(key)) return reference.get(key);
  const plural = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
  if (!plural) return undefined;
  return reference.get(`${plural[1]}_other`) ?? reference.get(`${plural[1]}_one`);
}

export function loadSources(path = SOURCES_PATH) {
  const data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  return Object.fromEntries(TARGETS.map((locale) => [locale, { ...(data[locale] ?? {}) }]));
}

/** Ordenado, para o diff de uma frase nova ser uma linha nova — e não o arquivo inteiro. */
export function saveSources(sources, path = SOURCES_PATH) {
  const sorted = Object.fromEntries(
    TARGETS.map((locale) => [
      locale,
      Object.fromEntries(
        Object.entries(sources[locale] ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    ]),
  );
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * A situação das traduções de um idioma.
 *
 * - `stale`: o português mudou depois do registro — reler a tradução e aceitar.
 * - `unrecorded`: a tradução existe e nunca foi registrada (escrita à mão, fora do add-keys).
 * - `orphan`: registro de uma chave que não existe mais no catálogo do idioma.
 *
 * Chave traduzida sem par em português é assunto do `i18n:parity` ("sobrando"), não daqui.
 */
export function translationStatus(locale, recorded, root = CATALOG_ROOT) {
  const stale = [];
  const unrecorded = [];
  const current = new Map();
  for (const namespace of listNamespaces(root)) {
    const reference = loadCatalog(REFERENCE, namespace, root);
    for (const key of loadCatalog(locale, namespace, root).keys()) {
      const text = referenceText(reference, key);
      if (text === undefined) continue;
      const id = `${namespace}:${key}`;
      const hash = sourceHash(text);
      current.set(id, hash);
      if (!(id in recorded)) unrecorded.push(id);
      else if (recorded[id] !== hash) stale.push(id);
    }
  }
  const orphan = Object.keys(recorded).filter((id) => !current.has(id));
  return { stale, unrecorded, orphan, current };
}
