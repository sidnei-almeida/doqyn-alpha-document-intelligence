/**
 * Codemod de extração de texto (Fase 6 do `.planning/I18N-PLANO.md`).
 *
 * Troca literal de interface por `t('chave')` e escreve a frase no catálogo. **Não é
 * automático**: roda por pasta, imprime o que pretende fazer, e só grava com `--write`. O diff
 * é para ser lido — texto em espanhol é 20 a 35% mais longo que em português, e é revisando
 * componente a componente, com o app aberto, que se descobre onde o botão quebra.
 *
 * O que ele toca:
 *
 * - **Texto entre tags JSX** — o caso mais puro, sempre para leitura humana.
 * - **Props de rótulo** conhecidas (`title`, `placeholder`, `aria-label`, `label`, `alt`…).
 *
 * O que ele **não** toca, e marca com `TODO(i18n)`:
 *
 * - Template com interpolação, que vira chave com `{{param}}` escrita à mão.
 * - Concatenação e ternário de singular/plural, que viram plural de catálogo.
 *
 * A chave sai do caminho do arquivo mais um resumo do texto: `components.calendarPanel.hoje`.
 * Sai em inglês só onde o texto já era; o resumo vem do português porque é o que existe — e a
 * chave é identificador, não texto, então não se traduz depois.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { globSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..');
const CATALOG_DIR = resolve(ROOT, 'src/i18n/catalog/pt-BR');

const USER_TEXT_PROPS = new Set([
  'title',
  'placeholder',
  'aria-label',
  'label',
  'alt',
  'description',
  'confirmLabel',
  'cancelLabel',
  'emptyMessage',
]);

type Edit = { start: number; end: number; replacement: string };
/** Onde inserir `const { t } = useTranslation(ns)` — depois da `{` do corpo da função. */
type HookInsertion = { position: number };
type Proposal = { file: string; key: string; text: string; kind: 'jsx' | 'prop'; edit: Edit };
type Skip = { file: string; line: number; text: string; reason: string };

/** `CalendarPanel.tsx` → `calendarPanel`. O componente é o contexto natural da chave. */
function contextFromFile(file: string): string {
  const name = basename(file).replace(/\.(tsx|ts)$/, '');
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function slugFromText(text: string): string {
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (words.length === 0) return 'texto';
  return (
    words[0]! +
    words
      .slice(1)
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join('')
  );
}

function isProse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;
  if (/^[A-Z0-9_]+$/.test(trimmed)) return false;
  const tokens = trimmed.split(/\s+/);
  if (
    tokens.length > 1 &&
    tokens.every((tk) => /^-?[a-z0-9]+([-:/.[\]%()][a-z0-9-:/.[\]%()]*)*$/.test(tk))
  ) {
    return false;
  }
  return /^[A-ZÀ-Ý]/.test(trimmed) || /[À-ÿ]/.test(trimmed) || tokens.length > 1;
}

function analyze(filePath: string, namespace: string) {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  const rel = relative(ROOT, filePath);
  const context = contextFromFile(rel);
  const proposals: Proposal[] = [];
  const skips: Skip[] = [];
  const hookPositions = new Set<number>();
  const usedKeys = new Set<string>();

  function uniqueKey(base: string): string {
    let key = base;
    let n = 2;
    while (usedKeys.has(key)) key = `${base}${n++}`;
    usedKeys.add(key);
    return key;
  }

  function lineOf(node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  }

  /**
   * O `t` tem de vir do hook, não de um import de módulo.
   *
   * `useTranslation` é o que assina a troca de idioma: sem ele o componente renderiza a frase
   * certa na primeira vez e nunca mais muda. Por isso o codemod sobe do literal até a função
   * que o contém e marca ali a inserção — é a única forma de o resultado funcionar ao trocar
   * de idioma sem recarregar a página.
   */
  function markHook(node: ts.Node) {
    let current: ts.Node | undefined = node;
    while (current) {
      const body =
        ts.isFunctionDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current)
          ? current.body
          : undefined;
      if (body && ts.isBlock(body)) {
        hookPositions.add(body.getStart(sourceFile) + 1);
        return;
      }
      current = current.parent;
    }
  }

  function walk(node: ts.Node) {
    if (ts.isJsxText(node) && isProse(node.text)) {
      const text = node.text.trim();
      const key = uniqueKey(`${context}.${slugFromText(text)}`);
      const leading = node.text.slice(0, node.text.indexOf(text[0]!));
      const trailing = node.text.slice(node.text.indexOf(text[0]!) + text.length);
      markHook(node);
      proposals.push({
        file: rel,
        key,
        text,
        kind: 'jsx',
        edit: {
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: `${leading}{t('${key}')}${trailing}`,
        },
      });
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText();
      const value = node.initializer;
      if (USER_TEXT_PROPS.has(name) && ts.isStringLiteral(value) && isProse(value.text)) {
        const key = uniqueKey(`${context}.${slugFromText(value.text)}`);
        markHook(node);
        proposals.push({
          file: rel,
          key,
          text: value.text,
          kind: 'prop',
          edit: {
            start: value.getStart(sourceFile),
            end: value.getEnd(),
            replacement: `{t('${key}')}`,
          },
        });
      } else if (
        USER_TEXT_PROPS.has(name) &&
        ts.isJsxExpression(value) &&
        value.expression &&
        ts.isTemplateExpression(value.expression)
      ) {
        skips.push({
          file: rel,
          line: lineOf(node),
          text: value.getText().slice(0, 70),
          reason: 'template com interpolação',
        });
      }
    } else if (ts.isJsxExpression(node) && node.expression) {
      const inner = node.expression;

      /* O detector precisa distinguir `collapsed ? 'Expandir' : 'Recolher'` de
         `collapsed ? 'true' : 'false'`. A primeira versão olhava só para o texto bruto do nó e
         marcava todo ternário com alguma string — o resultado foi uma fila de revisão cheia de
         escolha de ícone e de className, que ninguém precisa traduzir. O critério passou a ser
         o mesmo `isProse` do resto: só entra na fila o que parece frase. */
      if (ts.isTemplateExpression(inner)) {
        const literals = [inner.head.text, ...inner.templateSpans.map((span) => span.literal.text)];
        if (literals.some(isProse)) {
          skips.push({
            file: rel,
            line: lineOf(node),
            text: inner.getText().replace(/\s+/g, ' ').slice(0, 70),
            reason: 'template com interpolação',
          });
        }
      } else if (ts.isConditionalExpression(inner)) {
        const branches = [inner.whenTrue, inner.whenFalse].filter(
          (branch): branch is ts.StringLiteral => ts.isStringLiteral(branch),
        );
        if (branches.length === 2 && branches.some((branch) => isProse(branch.text))) {
          skips.push({
            file: rel,
            line: lineOf(node),
            text: inner.getText().replace(/\s+/g, ' ').slice(0, 70),
            reason: 'ternário de texto — vira plural ou select',
          });
        }
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  const hooks: HookInsertion[] = [...hookPositions].map((position) => ({ position }));
  return { source, proposals, skips, hooks, namespace };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const dir = args.find((a) => !a.startsWith('--')) ?? 'src/components';
  const namespace = args.find((a) => a.startsWith('--ns='))?.slice(5) ?? 'components';

  const files = globSync(`${dir}/**/*.tsx`, { cwd: ROOT }).map((f) => resolve(ROOT, f));
  const catalogPath = resolve(CATALOG_DIR, `${namespace}.json`);
  const catalog: Record<string, unknown> = existsSync(catalogPath)
    ? (JSON.parse(readFileSync(catalogPath, 'utf8')) as Record<string, unknown>)
    : {};

  let totalProposals = 0;
  const allSkips: Skip[] = [];

  for (const file of files) {
    const { source, proposals, skips, hooks } = analyze(file, namespace);
    allSkips.push(...skips);
    if (proposals.length === 0) continue;
    totalProposals += proposals.length;

    for (const proposal of proposals) {
      const [context, leaf] = proposal.key.split('.');
      const bucket = (catalog[context!] as Record<string, string>) ?? {};
      bucket[leaf!] = proposal.text;
      catalog[context!] = bucket;
      if (!write) console.log(`  ${proposal.key.padEnd(46)} ${proposal.text.slice(0, 60)}`);
    }

    if (write) {
      const edits: Edit[] = [
        ...proposals.map((proposal) => proposal.edit),
        ...(source.includes('useTranslation(')
          ? []
          : hooks.map((hook) => ({
              start: hook.position,
              end: hook.position,
              replacement: `\n  const { t } = useTranslation('${namespace}');\n`,
            }))),
      ];

      let output = source;
      for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
        output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
      }

      /**
       * O import entra depois do **último `ImportDeclaration`**, lido da árvore.
       *
       * A primeira versão procurava a última linha começando com `import ` — e num import
       * multilinha essa linha é a primeira (`import {`), não a última. O resultado foi um
       * `import` enfiado no meio de outro, com erro de sintaxe em quatro arquivos. Prefixo de
       * linha não sabe onde uma declaração termina; a árvore sabe.
       */
      if (!output.includes("from 'react-i18next'")) {
        const parsed = ts.createSourceFile(
          file,
          output,
          ts.ScriptTarget.ES2022,
          true,
          ts.ScriptKind.TSX,
        );
        const imports = parsed.statements.filter(ts.isImportDeclaration);
        const insertAt = imports.length > 0 ? imports[imports.length - 1]!.getEnd() : 0;
        output = `${output.slice(0, insertAt)}\nimport { useTranslation } from 'react-i18next';${output.slice(insertAt)}`;
      }

      writeFileSync(file, output);
    }
  }

  if (write) {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const sorted = Object.fromEntries(
      Object.entries(catalog)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [
          k,
          Object.fromEntries(
            Object.entries(v as Record<string, string>).sort(([a], [b]) => a.localeCompare(b)),
          ),
        ]),
    );
    writeFileSync(catalogPath, `${JSON.stringify(sorted, null, 2)}\n`);
  }

  console.log('');
  console.log(
    `${totalProposals} literal(is) ${write ? 'extraído(s)' : 'a extrair'} em ${dir} → ${namespace}.json`,
  );
  if (allSkips.length > 0) {
    console.log('');
    console.log(`${allSkips.length} caso(s) para a mão:`);
    for (const skip of allSkips) {
      console.log(`  ${skip.file}:${skip.line}  ${skip.reason}`);
      console.log(`      ${skip.text}`);
    }
  }
  if (write) {
    console.log('');
    console.log('Import e hook inseridos. Rode typecheck e lint: o codemod não sabe de escopo.');
  }
}

main();
