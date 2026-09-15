// Uso: node scripts/i18n-add-keys.mjs spec.json
// spec: { "<namespace>": { "<a.b.c>": ["pt", "en", "es"] | null | { "one": [...], "other": [...], "many": [...] } } }
// null apaga a chave nos três catálogos.
// Registra em src/i18n/translation-sources.json contra qual português cada tradução escrita saiu
// (ver scripts/i18n-sources.mjs) — quem monta a spec escreve os três idiomas juntos.
import fs from 'node:fs';
import path from 'node:path';
import {
  CATALOG_ROOT,
  flatten,
  loadSources,
  referenceText,
  saveSources,
  sourceHash,
} from './i18n-sources.mjs';

const ROOT = CATALOG_ROOT;
const LOCALES = ['pt-BR', 'en-US', 'es-419'];
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sources = loadSources();

function setDeep(obj, dotted, value, file) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (cur[part] === undefined) cur[part] = {};
    if (typeof cur[part] !== 'object')
      throw new Error(`${file}: ${dotted} colide com folha em ${part}`);
    cur = cur[part];
  }
  const last = parts.at(-1);
  if (cur[last] !== undefined && typeof cur[last] === 'object')
    throw new Error(`${file}: ${dotted} é objeto`);
  if (cur[last] !== undefined && cur[last] !== value) {
    console.warn(
      `  sobrescreve ${path.basename(path.dirname(file))}/${path.basename(file)}:${dotted}`,
    );
  }
  cur[last] = value;
}

function deleteDeep(obj, dotted) {
  const parts = dotted.split('.');
  const stack = [];
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (!cur || typeof cur[part] !== 'object') return;
    stack.push([cur, part]);
    cur = cur[part];
  }
  delete cur[parts.at(-1)];
  for (const [parent, part] of stack.reverse()) {
    if (Object.keys(parent[part]).length === 0) delete parent[part];
  }
}

const PLURAL_LEAF = /_(zero|one|two|few|many|other)$/;

let total = 0;
for (const [ns, entries] of Object.entries(spec)) {
  const catalogs = LOCALES.map((locale) => {
    const file = path.join(ROOT, locale, `${ns}.json`);
    return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  });
  const written = []; // [índice do idioma traduzido, chave-folha]
  const removed = [];
  for (const [key, value] of Object.entries(entries)) {
    if (value === null) {
      catalogs.forEach((c) => deleteDeep(c.data, key));
      removed.push(key);
    } else if (Array.isArray(value)) {
      if (value.length !== 3) throw new Error(`${ns}:${key} precisa de 3 valores`);
      catalogs.forEach((c, i) => setDeep(c.data, key, value[i], c.file));
      written.push([1, key], [2, key]);
    } else {
      for (const [cat, triple] of Object.entries(value)) {
        catalogs.forEach((c, i) => {
          if (triple[i] === null || triple[i] === undefined) return;
          setDeep(c.data, `${key}_${cat}`, triple[i], c.file);
          if (i > 0) written.push([i, `${key}_${cat}`]);
        });
      }
    }
    total += 1;
  }
  for (const c of catalogs) fs.writeFileSync(c.file, `${JSON.stringify(c.data, null, 2)}\n`);

  // Hash depois de gravar: o `many` do espanhol responde ao `_other` que a mesma spec escreveu.
  const reference = new Map(flatten(catalogs[0].data));
  for (const [i, key] of written) {
    const text = referenceText(reference, key);
    if (text !== undefined) sources[LOCALES[i]][`${ns}:${key}`] = sourceHash(text);
  }
  for (const key of removed) {
    for (const locale of LOCALES.slice(1)) {
      for (const id of Object.keys(sources[locale])) {
        const leaf = id.slice(ns.length + 1);
        if (!id.startsWith(`${ns}:`)) continue;
        const isPluralOf = PLURAL_LEAF.test(leaf) && leaf.replace(PLURAL_LEAF, '') === key;
        if (leaf === key || leaf.startsWith(`${key}.`) || isPluralOf) delete sources[locale][id];
      }
    }
  }
}
saveSources(sources);
console.log(`${total} entradas aplicadas.`);
