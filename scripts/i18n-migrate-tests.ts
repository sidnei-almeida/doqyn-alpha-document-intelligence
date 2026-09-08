/**
 * Migra asserções de teste de frase para chave (§7.2 do `.planning/I18N-PLANO.md`).
 *
 * O projeto tem 126 arquivos de teste que leem código-fonte e afirmam sobre o texto que
 * encontram: `assert.ok(source.includes('Nenhum grupo criado ainda.'))`. Com a frase no
 * catálogo, o fonte passa a dizer `t('rules.nenhumGrupoCriado')` e a asserção não acha mais
 * nada. Foi o que quebrou 95 testes.
 *
 * A troca é de frase por **chave** — e o teste fica mais estável do que era. Antes, qualquer
 * ajuste de redação o derrubava, mesmo sem nada ter mudado de comportamento; a chave só muda
 * quando o elemento muda de fato.
 *
 * O que ele faz:
 *
 * - Monta um índice reverso de todos os catálogos: frase → `namespace.contexto.chave`.
 * - Procura nos testes por `includes('<frase>')` e por `includes('<attr>="<frase>"')`.
 * - Troca pela chave, preservando a forma do atributo quando havia uma.
 *
 * O que ele **não** faz, e reporta para a mão: frase que existe em mais de um catálogo com
 * chaves diferentes. Escolher sozinho ali seria chutar qual componente o teste tem em vista.
 *
 * Uso:
 *   npx tsx scripts/i18n-migrate-tests.ts            mostra o que faria
 *   npx tsx scripts/i18n-migrate-tests.ts --write    aplica
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG_GLOB = 'src/i18n/catalog/pt-BR/*.json';

type Entry = { key: string; namespace: string };

function flatten(value: Record<string, unknown>, prefix: string): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return flatten(entry as Record<string, unknown>, path);
    }
    return typeof entry === 'string' ? ([[path, entry]] as Array<[string, string]>) : [];
  });
}

function buildIndex(): Map<string, Entry[]> {
  const index = new Map<string, Entry[]>();
  for (const file of globSync(CATALOG_GLOB, { cwd: ROOT })) {
    const namespace = basename(file, '.json');
    if (namespace === 'errors') continue; // erros não aparecem no fonte como texto
    const catalog = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as Record<string, unknown>;
    for (const [key, phrase] of flatten(catalog, '')) {
      /* Sufixo de plural é detalhe do i18next, não parte da chave que o fonte escreve. */
      const canonical = key.replace(/_(one|other|zero)$/, '');
      const list = index.get(phrase) ?? [];
      if (!list.some((entry) => entry.key === canonical)) {
        list.push({ key: canonical, namespace });
      }
      index.set(phrase, list);
    }
  }
  return index;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const write = process.argv.includes('--write');
  const index = buildIndex();

  let trocas = 0;
  const ambiguas: Array<{ file: string; phrase: string; options: string[] }> = [];
  const tocados: string[] = [];

  for (const file of globSync('tests/*.test.ts', { cwd: ROOT })) {
    const path = resolve(ROOT, file);
    let source = readFileSync(path, 'utf8');
    const original = source;

    for (const [phrase, entries] of index) {
      if (phrase.length < 4) continue;
      if (!source.includes(phrase)) continue;

      /**
       * Frase curta colide entre catálogos com frequência — "Nome" existe em sete. Mas a
       * colisão só importa se um teste de fato afirma sobre aquela frase, e o nome do arquivo
       * de teste quase sempre diz de qual feature ele trata: `library-toolbar.test.ts` fala do
       * namespace `library`. Quando um dos candidatos bate com o nome do arquivo, ele vence.
       */
      let escolhido = entries[0]!;

      /* Se todos os candidatos terminam na mesma folha, não há ambiguidade a resolver: a
         asserção vai ser sobre a folha de qualquer jeito. "Enviar documento" existe em três
         catálogos e nos três é `.enviarDocumento`. */
      const folhas = new Set(entries.map((entry) => entry.key.split('.').pop()));
      if (entries.length > 1 && folhas.size > 1) {
        const pistas = basename(file, '.test.ts').split('-');
        const porNome = entries.filter((entry) =>
          pistas.some((pista) => entry.namespace.toLowerCase() === pista.toLowerCase()),
        );
        if (porNome.length !== 1) {
          ambiguas.push({ file, phrase, options: entries.map((e) => `${e.namespace}:${e.key}`) });
          continue;
        }
        escolhido = porNome[0]!;
      }

      /**
       * A asserção passa a ser sobre a **folha** da chave, não sobre a chave inteira.
       *
       * O motivo é que a mesma palavra vira contextos diferentes em arquivos diferentes:
       * "Atualizado" é `fileTable.atualizado` numa tela e `documentDetailsShared.atualizado`
       * noutra. O teste lê um arquivo específico e a ferramenta não sabe qual — a primeira
       * versão chutou pelo catálogo e errou. `.atualizado` casa com qualquer contexto e
       * continua sendo mais estável que a frase, que muda a cada ajuste de redação.
       */
      const leaf = `.${escolhido.key.split('.').pop()}`;
      const escaped = escapeRegex(phrase);

      /**
       * A troca acontece **só** dentro de `includes('...')`, e nunca numa linha que afirma
       * ausência.
       *
       * A primeira versão trocava toda ocorrência da frase no arquivo de teste, e estragou
       * duas coisas que não eram texto de tela: `assert.equal(x.includes('Enviar documento'),
       * false)`, que passou a afirmar sobre uma chave que ninguém escreve, e
       * `page.includes("label: 'Enviar documento'")`, onde a frase é dado de uma fixture, não
       * rótulo renderizado. Alvo largo em teste é pior que alvo nenhum: o teste continua
       * verde afirmando outra coisa.
       */
      const positivo = new RegExp(`includes\\('${escaped}'\\)`, 'g');
      source = source
        .split('\n')
        .map((linha) => {
          if (linha.includes(', false)') || linha.includes('=== false')) return linha;
          return linha.replace(positivo, () => {
            trocas += 1;
            return `includes('${leaf}')`;
          });
        })
        .join('\n');

    }

    if (source !== original) {
      tocados.push(file);
      if (write) writeFileSync(path, source);
    }
  }

  console.log('');
  console.log(`${index.size} frases no índice · ${trocas} troca(s) em ${tocados.length} arquivo(s)`);
  if (!write) console.log('(simulação — use --write para aplicar)');

  if (ambiguas.length > 0) {
    console.log('');
    console.log(`${ambiguas.length} frase(s) em mais de um catálogo, para decidir à mão:`);
    const vistos = new Set<string>();
    for (const item of ambiguas) {
      const chave = `${item.phrase}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      console.log(`  "${item.phrase.slice(0, 60)}"`);
      console.log(`      ${item.options.join('  |  ')}`);
    }
  }
}

main();
