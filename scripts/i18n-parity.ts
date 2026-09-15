/**
 * Paridade estrutural entre os catálogos (Fase 11 do `.planning/I18N-PLANO.md`).
 *
 * `i18n:check` conta chave que falta, e só em `common` e `errors`. Isso não basta para uma
 * tradução: uma chave pode existir nos três idiomas e ainda assim quebrar a tela.
 *
 * O que este portão cobra, e por que cada coisa:
 *
 * **Chave que falta.** Cai no `pt-BR` pelo `fallbackLng` — degradação silenciosa, e uma tela
 * meio traduzida parece produto abandonado. É o número que mede o progresso da Fase 11.
 *
 * **Chave a mais.** Quase sempre é chave renomeada no `pt-BR` e esquecida na tradução: texto
 * morto que ninguém vê e que o próximo tradutor vai tentar manter em dia.
 *
 * **Parâmetro de interpolação.** `{{count}}` que vira `{{contador}}` na tradução não estoura —
 * o i18next escreve o placeholder cru na tela. Um `{{version}}` perdido no meio de uma frase
 * traduzida é o defeito mais caro desta fase, porque passa por toda revisão de fluência.
 *
 * **Família de plural.** O i18next escolhe o sufixo pelo `Intl.PluralRules` do idioma-alvo, e
 * as categorias não são as mesmas em toda língua. Faltar `_other` em inglês é tela quebrada
 * para todo número diferente de um.
 *
 * **Frase idêntica ao português.** Não é erro — `PDF`, `DOQYN`, `WhatsApp` e `E-mail` são iguais
 * de propósito. Sai como aviso, com a contagem, para a revisão saber onde olhar.
 *
 * Uso:
 *   npm run i18n:parity              resumo por idioma e namespace
 *   npm run i18n:parity -- --detalhe imprime cada chave problemática
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG_ROOT = resolve(ROOT, 'src/i18n/catalog');
const REFERENCE = 'pt-BR';
const TARGETS = ['en-US', 'es-419'];

/**
 * Frase igual ao português que é igual de propósito.
 *
 * Sem esta lista o aviso de "idêntica ao original" apontaria para dezenas de acertos, e um aviso
 * que aponta sobretudo para acertos deixa de ser lido.
 */
const IDENTICAS_ESPERADAS =
  /^(DOQYN|PDF|WhatsApp|E-mail|Email|CPF|CNPJ|NIF|VAT|Preview|OK|—|\{\{[\w.]+\}\}|[\d\s.,:/+()%-]+)$/i;

type Leaf = { key: string; value: string };

function flatten(node: unknown, prefix = ''): Leaf[] {
  if (typeof node === 'string') return [{ key: prefix, value: node }];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

function load(locale: string, namespace: string): Leaf[] | null {
  const path = resolve(CATALOG_ROOT, locale, `${namespace}.json`);
  if (!existsSync(path)) return null;
  return flatten(JSON.parse(readFileSync(path, 'utf8')));
}

/** `{{count}}` e `{{version}}`, ordenados, para comparar conjuntos e não posições. */
function params(phrase: string): string {
  return [...phrase.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)]
    .map((m) => m[1]!)
    .sort()
    .join(',');
}

const SUFIXOS = ['zero', 'one', 'two', 'few', 'many', 'other'];

function pluralBase(key: string): { base: string; suffix: string } | null {
  const match = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
  return match ? { base: match[1]!, suffix: match[2]! } : null;
}

/** As categorias que o runtime vai pedir naquele idioma — nem uma a mais, nem a menos. */
function categoriasDe(locale: string): string[] {
  const rules = new Intl.PluralRules(locale);
  const categorias = new Set<string>();
  /* Não há API para listar as categorias de um idioma; `resolvedOptions().pluralCategories`
     existe em runtimes recentes, e a sondagem cobre o resto. */
  const resolved = (rules.resolvedOptions() as { pluralCategories?: string[] }).pluralCategories;
  if (resolved?.length) return resolved.slice().sort();
  for (const n of [0, 1, 2, 3, 5, 11, 100, 1.5]) categorias.add(rules.select(n));
  return [...categorias].sort();
}

type Problema = { tipo: string; namespace: string; chave: string; detalhe: string };

function main(): void {
  const detalhe = process.argv.includes('--detalhe');

  const namespaces = readdirSync(resolve(CATALOG_ROOT, REFERENCE))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();

  let falhou = false;

  for (const locale of TARGETS) {
    const categorias = categoriasDe(locale);
    const problemas: Problema[] = [];
    let traduzidas = 0;
    let totalAlvo = 0;
    let identicas = 0;
    const semArquivo: string[] = [];
    const porNamespace: Array<[string, number, number]> = [];

    for (const namespace of namespaces) {
      const referencia = load(REFERENCE, namespace)!;

      /* Quantas chaves este namespace precisa ter no idioma-alvo: as que não são plural, mais
         uma por categoria de plural de cada família. */
      const familiasRef = new Set(
        referencia.map((leaf) => pluralBase(leaf.key)?.base).filter((b): b is string => !!b),
      );
      const simplesRef = referencia.filter((leaf) => !pluralBase(leaf.key)).length;
      const esperadoNoAlvo = simplesRef + familiasRef.size * categorias.length;
      totalAlvo += esperadoNoAlvo;

      const alvo = load(locale, namespace);
      if (!alvo) {
        if (referencia.length > 0) semArquivo.push(namespace);
        porNamespace.push([namespace, 0, esperadoNoAlvo]);
        continue;
      }

      const mapaAlvo = new Map(alvo.map((leaf) => [leaf.key, leaf.value]));
      const mapaRef = new Map(referencia.map((leaf) => [leaf.key, leaf.value]));

      let presentes = 0;
      for (const { key, value } of referencia) {
        const plural = pluralBase(key);
        /* Chave de plural é conferida pela família, logo abaixo: exigir a mesma chave aqui
           acusaria `_one` ausente num idioma que não tem essa categoria. */
        if (plural) continue;

        const traduzida = mapaAlvo.get(key);
        if (traduzida === undefined) {
          problemas.push({ tipo: 'faltando', namespace, chave: key, detalhe: value });
          continue;
        }
        presentes += 1;

        if (params(value) !== params(traduzida)) {
          problemas.push({
            tipo: 'parâmetro',
            namespace,
            chave: key,
            detalhe: `${REFERENCE} tem [${params(value) || '—'}], ${locale} tem [${params(traduzida) || '—'}]`,
          });
        }
        if (traduzida === value && !IDENTICAS_ESPERADAS.test(traduzida.trim())) identicas += 1;
      }

      /* Famílias de plural: a base tem de existir nas categorias do idioma-alvo, e só nelas. */
      const familias = new Set(
        referencia.map((leaf) => pluralBase(leaf.key)?.base).filter((b): b is string => !!b),
      );
      for (const base of familias) {
        for (const categoria of categorias) {
          const chave = `${base}_${categoria}`;
          const traduzida = mapaAlvo.get(chave);
          if (traduzida === undefined) {
            const modelo =
              mapaRef.get(`${base}_other`) ?? mapaRef.get(`${base}_one`) ?? '(sem modelo)';
            problemas.push({ tipo: 'plural', namespace, chave, detalhe: modelo });
            continue;
          }
          presentes += 1;
          /**
           * O modelo é a **mesma** categoria no português, e só depois o `_other`.
           *
           * Comparar todo mundo contra `_other` acusava tradução correta: o singular do próprio
           * `pt-BR` escreve "Este documento" e "1 membro" por extenso, sem `{{count}}`, e é assim
           * que o inglês e o espanhol também devem escrever. O `_other` só entra como modelo para
           * categoria que o português não tem — o `many` do espanhol.
           */
          const modeloRef =
            mapaRef.get(chave) ?? mapaRef.get(`${base}_other`) ?? mapaRef.get(`${base}_one`);
          if (modeloRef && params(modeloRef) !== params(traduzida)) {
            problemas.push({
              tipo: 'parâmetro',
              namespace,
              chave,
              detalhe: `${REFERENCE} tem [${params(modeloRef) || '—'}], ${locale} tem [${params(traduzida) || '—'}]`,
            });
          }
        }
        for (const sufixo of SUFIXOS) {
          if (categorias.includes(sufixo)) continue;
          if (mapaAlvo.has(`${base}_${sufixo}`)) {
            problemas.push({
              tipo: 'plural a mais',
              namespace,
              chave: `${base}_${sufixo}`,
              detalhe: `${locale} não tem a categoria "${sufixo}" (tem ${categorias.join(', ')})`,
            });
          }
        }
      }

      const chavesRef = new Set(referencia.map((leaf) => leaf.key));
      for (const { key } of alvo) {
        if (chavesRef.has(key)) continue;
        if (pluralBase(key) && chavesRef.has(`${pluralBase(key)!.base}_other`)) continue;
        if (pluralBase(key) && chavesRef.has(`${pluralBase(key)!.base}_one`)) continue;
        problemas.push({ tipo: 'sobrando', namespace, chave: key, detalhe: '' });
      }

      traduzidas += presentes;
      porNamespace.push([namespace, presentes, esperadoNoAlvo]);
    }

    const bloqueantes = problemas.filter((p) => p.tipo !== 'faltando' && p.tipo !== 'plural');
    if (bloqueantes.length) falhou = true;

    /**
     * O total é o do idioma-alvo, não o do português.
     *
     * O espanhol tem uma categoria de plural que o português não tem, então escrever tudo o que
     * ele precisa dá 1.929 chaves contra 1.909 de referência — e a conta ingênua imprimia 101%,
     * que lê como defeito justamente quando está tudo certo. O denominador certo é quantas
     * chaves *aquele* idioma precisa ter.
     */
    const pct = totalAlvo ? Math.round((traduzidas / totalAlvo) * 100) : 100;
    console.log('');
    console.log(`${locale} — ${traduzidas}/${totalAlvo} chaves (${pct}%)`);
    console.log('─'.repeat(74));
    console.log(`categorias de plural       ${categorias.join(', ')}`);
    console.log(`namespaces sem arquivo     ${semArquivo.length}`);
    console.log(
      `chaves faltando            ${problemas.filter((p) => p.tipo === 'faltando').length}`,
    );
    console.log(
      `plurais faltando           ${problemas.filter((p) => p.tipo === 'plural').length}`,
    );
    console.log(
      `ERRO parâmetro divergente  ${problemas.filter((p) => p.tipo === 'parâmetro').length}`,
    );
    console.log(
      `ERRO chave sobrando        ${problemas.filter((p) => p.tipo === 'sobrando').length}`,
    );
    console.log(
      `ERRO plural a mais         ${problemas.filter((p) => p.tipo === 'plural a mais').length}`,
    );
    console.log(`aviso frase igual ao pt-BR ${identicas}`);
    console.log('─'.repeat(74));

    const incompletos = porNamespace.filter(([, feito, total]) => feito < total);
    if (incompletos.length) {
      console.log('  incompletos:');
      for (const [ns, feito, total] of incompletos) {
        console.log(`    ${ns.padEnd(20)} ${String(feito).padStart(4)}/${total}`);
      }
    }

    if (bloqueantes.length) {
      console.log('');
      console.log('  ERROS — a tela quebra ou mostra texto morto:');
      for (const p of bloqueantes.slice(0, 40)) {
        console.log(`    [${p.tipo}] ${p.namespace}:${p.chave}  ${p.detalhe}`);
      }
      if (bloqueantes.length > 40) console.log(`    … e mais ${bloqueantes.length - 40}.`);
    }

    if (detalhe) {
      const pendentes = problemas.filter((p) => p.tipo === 'faltando' || p.tipo === 'plural');
      for (const p of pendentes) {
        console.log(`    [${p.tipo}] ${p.namespace}:${p.chave}  "${p.detalhe}"`);
      }
    }
  }

  console.log('');
  if (falhou) {
    console.log('FALHOU.');
    process.exit(1);
  }
  console.log('OK.');
}

main();
