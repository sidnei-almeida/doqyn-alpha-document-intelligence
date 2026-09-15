/**
 * Portão de CI da internacionalização (Fase 13 do `.planning/I18N-PLANO.md`, antecipado).
 *
 * Três coisas que só um script pega:
 *
 * 1. **Código de erro sem frase.** O servidor é dono da lista de `code`; o front é dono da
 *    frase. Nada no compilador liga os dois, então um `ServiceError` novo entra sem catálogo e
 *    o defeito só aparece quando alguém tropeça naquele erro — em produção, no idioma errado.
 * 2. **Chave sem par nos outros idiomas.** Enquanto só o português existe, isso é informação,
 *    não falha; quando `en-US` for exposto, vira bloqueio.
 * 3. **Códigos de passagem crescendo.** `VALIDATION_ERROR`, `NOT_FOUND` e `FORBIDDEN` deixam a
 *    frase do servidor passar direto porque o código não distingue o caso. São dívida contada:
 *    se o número sobe, alguém acrescentou um genérico em vez de nomear o erro.
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const REFERENCE = 'pt-BR';
const LOCALES = ['pt-BR', 'en-US', 'es-419'];
const PASSTHROUGH_BUDGET = 3;

function loadCatalog(locale: string, namespace: string): Record<string, unknown> | null {
  const path = resolve(ROOT, `src/i18n/catalog/${locale}/${namespace}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function flatten(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === 'object' && !Array.isArray(entry)
      ? flatten(entry as Record<string, unknown>, path)
      : [path];
  });
}

function serviceErrorCodes(): string[] {
  const raw = execFileSync('npx', ['tsx', 'scripts/i18n-error-codes.ts', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw) as { occurrences: Array<{ code: string }> };
  return [...new Set(parsed.occurrences.map((occurrence) => occurrence.code))];
}

function main() {
  const problems: string[] = [];
  const notes: string[] = [];

  const errorCatalog = loadCatalog(REFERENCE, 'errors') ?? {};
  const codes = serviceErrorCodes();
  const semFrase = codes.filter((code) => !(code in errorCatalog));

  if (semFrase.length > 0) {
    problems.push(
      `${semFrase.length} código(s) de erro sem frase em ${REFERENCE}: ${semFrase.slice(0, 8).join(', ')}${semFrase.length > 8 ? '…' : ''}`,
    );
  }

  const passthrough = Object.entries(errorCatalog).filter(
    ([, phrase]) => typeof phrase === 'string' && phrase.trim() === '{{message}}',
  );
  if (passthrough.length > PASSTHROUGH_BUDGET) {
    problems.push(
      `${passthrough.length} códigos de passagem, orçamento é ${PASSTHROUGH_BUDGET}: ${passthrough.map(([code]) => code).join(', ')}`,
    );
  }

  const namespaces = ['common', 'errors'];
  for (const namespace of namespaces) {
    const reference = loadCatalog(REFERENCE, namespace);
    if (!reference) continue;
    const referenceKeys = flatten(reference);

    for (const locale of LOCALES.filter((item) => item !== REFERENCE)) {
      const catalog = loadCatalog(locale, namespace);
      if (!catalog) {
        notes.push(`${locale}/${namespace}.json ainda não existe (${referenceKeys.length} chaves)`);
        continue;
      }
      const keys = new Set(flatten(catalog));
      const faltando = referenceKeys.filter((key) => !keys.has(key));
      if (faltando.length > 0) {
        notes.push(`${locale}/${namespace}: ${faltando.length} chave(s) sem tradução`);
      }
    }
  }

  console.log('');
  console.log('Portão de i18n');
  console.log('─'.repeat(74));
  console.log(`códigos de erro em uso        ${codes.length}`);
  console.log(`frases no catálogo ${REFERENCE}    ${Object.keys(errorCatalog).length}`);
  console.log(
    `códigos de passagem           ${passthrough.length} (orçamento ${PASSTHROUGH_BUDGET})`,
  );
  console.log('─'.repeat(74));

  for (const note of notes) console.log(`  aviso   ${note}`);
  for (const problem of problems) console.log(`  ERRO    ${problem}`);

  console.log('');
  if (problems.length > 0) {
    console.log(`FALHOU — ${problems.length} problema(s).`);
    process.exit(1);
  }
  console.log('OK.');
}

main();
