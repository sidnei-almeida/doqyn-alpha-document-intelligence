// Uso: node scripts/i18n-add-keys.mjs spec.json
// spec: { "<namespace>": { "<a.b.c>": ["pt", "en", "es"] | null | { "one": [...], "other": [...], "many": [...] } } }
// null apaga a chave nos três catálogos.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../src/i18n/catalog');
const LOCALES = ['pt-BR', 'en-US', 'es-419'];
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function setDeep(obj, dotted, value, file) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (cur[part] === undefined) cur[part] = {};
    if (typeof cur[part] !== 'object') throw new Error(`${file}: ${dotted} colide com folha em ${part}`);
    cur = cur[part];
  }
  const last = parts.at(-1);
  if (cur[last] !== undefined && typeof cur[last] === 'object') throw new Error(`${file}: ${dotted} é objeto`);
  if (cur[last] !== undefined && cur[last] !== value) {
    console.warn(`  sobrescreve ${path.basename(path.dirname(file))}/${path.basename(file)}:${dotted}`);
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

let total = 0;
for (const [ns, entries] of Object.entries(spec)) {
  const catalogs = LOCALES.map((locale) => {
    const file = path.join(ROOT, locale, `${ns}.json`);
    return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  });
  for (const [key, value] of Object.entries(entries)) {
    if (value === null) {
      catalogs.forEach((c) => deleteDeep(c.data, key));
    } else if (Array.isArray(value)) {
      if (value.length !== 3) throw new Error(`${ns}:${key} precisa de 3 valores`);
      catalogs.forEach((c, i) => setDeep(c.data, key, value[i], c.file));
    } else {
      for (const [cat, triple] of Object.entries(value)) {
        catalogs.forEach((c, i) => {
          if (triple[i] === null || triple[i] === undefined) return;
          setDeep(c.data, `${key}_${cat}`, triple[i], c.file);
        });
      }
    }
    total += 1;
  }
  for (const c of catalogs) fs.writeFileSync(c.file, `${JSON.stringify(c.data, null, 2)}\n`);
}
console.log(`${total} entradas aplicadas.`);
