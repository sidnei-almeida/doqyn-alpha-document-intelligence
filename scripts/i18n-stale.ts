/**
 * Tradução desatualizada: a frase em português mudou e o inglês ou o espanhol não acompanhou.
 *
 * `i18n:parity` confere se a chave existe e se os parâmetros batem — não percebe uma tradução
 * que continua lá, correta para a frase de ontem. Este portão compara o hash da frase em
 * português de hoje com o registrado quando a tradução foi escrita (`scripts/i18n-sources.mjs`).
 *
 * Uso:
 *   npm run i18n:stale                            relatório; sai com 1 se houver desatualizada
 *   npm run i18n:stale -- --accept ns:chave       tradução conferida (vale para en-US e es-419)
 *   npm run i18n:stale -- --accept ns:prefixo.    aceita toda chave que começa assim
 *   npm run i18n:stale -- --all                   aceita tudo e apaga registro órfão
 *
 * Aceitar é dizer "reli a tradução contra o português novo". `i18n-add-keys` aceita sozinho o
 * que escreve, porque quem monta a spec escreve os três idiomas juntos.
 */
import { TARGETS, loadSources, saveSources, translationStatus } from './i18n-sources.mjs';

const args = process.argv.slice(2);
const acceptAll = args.includes('--all');
const patterns = args.filter((_, i) => args[i - 1] === '--accept');

function accepted(id: string): boolean {
  if (acceptAll) return true;
  return patterns.some((pattern) =>
    pattern.endsWith('.') || pattern.endsWith(':') ? id.startsWith(pattern) : id === pattern,
  );
}

const sources = loadSources() as Record<string, Record<string, string>>;
let changed = false;
let failed = false;

for (const locale of TARGETS) {
  const recorded = sources[locale]!;
  const { stale, unrecorded, orphan, current } = translationStatus(locale, recorded);

  for (const id of [...stale, ...unrecorded]) {
    if (!accepted(id)) continue;
    recorded[id] = current.get(id)!;
    changed = true;
  }
  if (acceptAll) {
    for (const id of orphan) delete recorded[id];
    changed ||= orphan.length > 0;
  }

  const pendingStale = stale.filter((id) => recorded[id] !== current.get(id));
  const pendingUnrecorded = unrecorded.filter((id) => recorded[id] === undefined);
  const pendingOrphan = orphan.filter((id) => id in recorded);
  if (pendingStale.length) failed = true;

  console.log('');
  console.log(`${locale} — ${current.size} traduções registráveis`);
  console.log('─'.repeat(74));
  console.log(`ERRO desatualizada   ${pendingStale.length}`);
  console.log(`aviso sem registro   ${pendingUnrecorded.length}`);
  console.log(`aviso registro órfão ${pendingOrphan.length}`);
  console.log('─'.repeat(74));
  const listed: Array<[string, string[]]> = [
    ['desatualizada', pendingStale],
    ['sem registro', pendingUnrecorded],
    ['órfão', pendingOrphan],
  ];
  for (const [label, ids] of listed) {
    for (const id of ids.slice(0, 40)) console.log(`    [${label}] ${id}`);
    if (ids.length > 40) console.log(`    … e mais ${ids.length - 40}.`);
  }
}

if (changed) saveSources(sources);

console.log('');
if (failed) {
  console.log('FALHOU. Releia a tradução contra o português novo e rode com --accept ns:chave.');
  process.exit(1);
}
console.log('OK.');
