/**
 * Auditoria de integridade das chaves de tradução.
 *
 * O compilador não liga `t('library.foo')` ao catálogo, e o lint também não. Uma chave que não
 * resolve passa por typecheck, passa por lint, passa pelo build — e aparece na tela como texto
 * cru, em produção, no idioma errado. É a única classe de defeito desta migração que nenhuma
 * outra ferramenta pega.
 *
 * Quatro coisas que ela procura:
 *
 * 1. **Chave sem entrada no catálogo.** Erro: alguém escreveu ou renomeou errado.
 * 2. **Namespace não declarado pelo componente.** `t('foo.bar')` só resolve se o `useTranslation`
 *    daquele arquivo tiver pedido o namespace certo — ou se a chave vier com prefixo explícito.
 *    É o defeito mais traiçoeiro: funciona no arquivo onde o namespace calha de ser o padrão e
 *    quebra no vizinho.
 * 3. **Entrada de catálogo que ninguém usa.** Aviso: sobra de refatoração, e custa tradução.
 * 4. **Frase idêntica em contextos diferentes.** Aviso: em outro idioma elas podem divergir, e
 *    quem traduz precisa saber que são duas.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG_DIR = 'src/i18n/catalog/pt-BR';

type Uso = { arquivo: string; linha: number; chave: string; namespaces: string[] };

function achatar(valor: Record<string, unknown>, prefixo = ''): string[] {
  return Object.entries(valor).flatMap(([chave, entrada]) => {
    const caminho = prefixo ? `${prefixo}.${chave}` : chave;
    return entrada && typeof entrada === 'object' && !Array.isArray(entrada)
      ? achatar(entrada as Record<string, unknown>, caminho)
      : [caminho];
  });
}

function carregarCatalogos() {
  const porNamespace = new Map<string, Set<string>>();
  const frases = new Map<string, string[]>();
  for (const arquivo of globSync(`${CATALOG_DIR}/*.json`, { cwd: ROOT })) {
    const ns = basename(arquivo, '.json');
    const dados = JSON.parse(readFileSync(resolve(ROOT, arquivo), 'utf8')) as Record<string, unknown>;
    porNamespace.set(ns, new Set(achatar(dados)));
    const anda = (v: Record<string, unknown>, pre = ''): void => {
      for (const [k, e] of Object.entries(v)) {
        const p = pre ? `${pre}.${k}` : k;
        if (e && typeof e === 'object') anda(e as Record<string, unknown>, p);
        else if (typeof e === 'string') {
          const lista = frases.get(e) ?? [];
          lista.push(`${ns}:${p}`);
          frases.set(e, lista);
        }
      }
    };
    anda(dados);
    }
  return { porNamespace, frases };
}

/** Os namespaces que aquele arquivo pediu: `useTranslation('x')` ou `useTranslation(['x','y'])`. */
function namespacesDe(fonte: string): string[] {
  const nss: string[] = [];
  for (const m of fonte.matchAll(/useTranslation\(\s*(\[[^\]]*\]|'[^']*')/g)) {
    for (const n of m[1]!.matchAll(/'([^']+)'/g)) nss.push(n[1]!);
  }
  /**
   * Um módulo `.ts` pode ter o seu próprio `t`, que prefixa o namespace antes de repassar —
   * é o que `confirmMessages.ts` faz. Sem reconhecer isso, a auditoria acusa 28 chaves que
   * resolvem perfeitamente, e um relatório que grita onde não há problema é um relatório que
   * ninguém lê.
   */
  const local = fonte.match(/const NS = '([^']+)'/);
  if (local && /function t\(/.test(fonte)) nss.push(local[1]!);

  return nss;
}

function coletarUsos(): Uso[] {
  const usos: Uso[] = [];
  const arquivos = [
    ...globSync('src/**/*.tsx', { cwd: ROOT }),
    ...globSync('src/**/*.ts', { cwd: ROOT }),
  ].filter((f) => !f.includes('/catalog/'));

  for (const arquivo of arquivos) {
    const fonte = readFileSync(resolve(ROOT, arquivo), 'utf8');
    /* O atalho de leitura procurava `t('` e pulava o arquivo inteiro quando não achava — mas
       `t(revealed ? 'a' : 'b')` não contém essa sequência. Três arquivos ficavam fora da
       análise e as chaves deles apareciam como órfãs. Filtro de desempenho que muda o
       resultado deixa de ser filtro de desempenho. */
    if (!fonte.includes('useTranslation(') && !fonte.includes('i18nKey') && !fonte.includes('i18n.t(')) {
      continue;
    }
    const nss = namespacesDe(fonte);
    const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);

    const registrar = (chave: string, pos: number) => {
      const { line } = sf.getLineAndCharacterOfPosition(pos);
      usos.push({ arquivo, linha: line + 1, chave, namespaces: nss });
    };

    const anda = (no: ts.Node) => {
      if (ts.isCallExpression(no)) {
        const nome = no.expression.getText();
        if (nome === 't' || nome.endsWith('.t')) {
          const arg = no.arguments[0];
          if (arg && ts.isStringLiteral(arg)) {
            registrar(arg.text, no.getStart(sf));
          } else if (arg && ts.isConditionalExpression(arg)) {
            /* `t(collapsed ? 'a.expandir' : 'a.recolher')` é o padrão que substituiu os
               ternários de texto. As duas chaves são literais e estão em uso; sem isto elas
               apareciam como órfãs, e uma lista de órfãs com falso positivo não serve para
               apagar nada. */
            for (const ramo of [arg.whenTrue, arg.whenFalse]) {
              if (ts.isStringLiteral(ramo)) registrar(ramo.text, no.getStart(sf));
            }
          }
        }
      }
      if (ts.isJsxAttribute(no) && no.name.getText() === 'i18nKey' && no.initializer) {
        const v = no.initializer;
        if (ts.isStringLiteral(v)) registrar(v.text, no.getStart(sf));
      }
      ts.forEachChild(no, anda);
    };
    anda(sf);
  }
  return usos;
}

function main() {
  const { porNamespace, frases } = carregarCatalogos();
  const usos = coletarUsos();

  const erros: string[] = [];
  const avisos: string[] = [];
  const usadas = new Set<string>();

  for (const uso of usos) {
    const temPrefixo = uso.chave.includes(':');
    const ns = temPrefixo ? uso.chave.split(':')[0]! : null;
    const caminho = temPrefixo ? uso.chave.split(':').slice(1).join(':') : uso.chave;
    const base = caminho.replace(/_(one|other|zero)$/, '');

    const candidatos = ns ? [ns] : uso.namespaces;
    if (candidatos.length === 0) {
      erros.push(`${uso.arquivo}:${uso.linha}  t('${uso.chave}') sem namespace declarado nem prefixo`);
      continue;
    }

    const achou = candidatos.some((n) => {
      const chaves = porNamespace.get(n);
      if (!chaves) return false;
      return chaves.has(base) || chaves.has(`${base}_one`) || chaves.has(`${base}_other`);
    });

    if (achou) {
      for (const n of candidatos) usadas.add(`${n}:${base}`);
    } else {
      const onde = [...porNamespace.entries()]
        .filter(([, ks]) => ks.has(base) || ks.has(`${base}_one`))
        .map(([n]) => n);
      const dica = onde.length ? ` (existe em: ${onde.join(', ')})` : '';
      erros.push(
        `${uso.arquivo}:${uso.linha}  t('${uso.chave}') não resolve em [${candidatos.join(', ')}]${dica}`,
      );
    }
  }

  /**
   * Chave que vive num mapa e é consumida por `t(item.labelKey)`.
   *
   * `NAV_ITEMS`, `THEME_LABEL_KEYS` e `DOCUMENT_STATUSES` guardam a chave como dado; quem
   * chama `t` recebe uma variável, e nenhuma análise estática liga as duas pontas. Contar
   * qualquer literal na forma `ns:caminho` fecha esse buraco — mas só quando o namespace
   * existe de fato como catálogo. Sem essa condição, `logUploadDev('analyze:start')` viraria
   * uso de tradução, e a auditoria passaria a mentir a favor.
   */
  for (const arquivo of [
    ...globSync('src/**/*.ts', { cwd: ROOT }),
    ...globSync('src/**/*.tsx', { cwd: ROOT }),
  ]) {
    if (arquivo.includes('/catalog/')) continue;
    const fonte = readFileSync(resolve(ROOT, arquivo), 'utf8');
    for (const m of fonte.matchAll(/'([a-zA-Z]+):([\w.]+)'/g)) {
      const ns = m[1]!;
      if (!porNamespace.has(ns)) continue;
      usadas.add(`${ns}:${m[2]!.replace(/_(one|other|zero)$/, '')}`);
    }
  }

  /**
   * `errors` fica de fora da conta de órfãs.
   *
   * Ele é consultado por `t(\`errors:${code}\`)` — o código vem do servidor, em runtime, e
   * nenhuma análise estática o alcança. Toda chave dele pareceria órfã, e 274 falsos positivos
   * afogariam os poucos verdadeiros. Quem garante a cobertura desse namespace é o
   * `i18n:check`, que compara a lista de códigos do servidor com o catálogo.
   */
  const DINAMICOS = new Set(['errors']);

  for (const [ns, chaves] of porNamespace) {
    if (DINAMICOS.has(ns)) continue;
    for (const chave of chaves) {
      const base = chave.replace(/_(one|other|zero)$/, '');
      if (!usadas.has(`${ns}:${base}`)) avisos.push(`órfã: ${ns}:${chave}`);
    }
  }

  const duplicadas = [...frases.entries()].filter(([, locais]) => locais.length > 1);

  console.log('');
  console.log('Auditoria de chaves de tradução');
  console.log('─'.repeat(74));
  console.log(`usos de t() analisados     ${usos.length}`);
  console.log(`namespaces                 ${porNamespace.size}`);
  console.log(`chaves órfãs               ${avisos.length}`);
  console.log(`frases repetidas           ${duplicadas.length}`);
  console.log(`chaves que não resolvem    ${erros.length}`);
  console.log('─'.repeat(74));

  if (erros.length) {
    console.log('');
    console.log('ERROS — a tela mostra a chave crua:');
    for (const e of erros.slice(0, 40)) console.log(`  ${e}`);
    if (erros.length > 40) console.log(`  … e mais ${erros.length - 40}.`);
  }

  if (process.argv.includes('--orfas') && avisos.length) {
    console.log('');
    for (const a of avisos) console.log(`  ${a}`);
  }

  console.log('');
  if (erros.length) {
    console.log('FALHOU.');
    process.exit(1);
  }
  console.log('OK.');
}

main();
