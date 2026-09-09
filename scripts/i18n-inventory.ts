/**
 * Inventário de strings para a internacionalização (Fase 0 do `.planning/I18N-PLANO.md`).
 *
 * Substitui a contagem por acentuação que sustentou o plano. Aquela heurística tinha um viés
 * conhecido e grande: só via literal com `á`, `ç`, `ã`. "Save", "Cancel", "Upload file" e toda
 * frase em português sem acento ficavam de fora, e por isso todo número do plano é um piso,
 * não um total.
 *
 * Aqui a leitura é pela árvore sintática, então a classificação é por **onde** o literal está,
 * não pelos caracteres que tem:
 *
 * - `user`      — texto que uma pessoa lê. Filho de JSX, prop conhecida de rótulo, argumento de
 *                 `toast.*` / `confirm(...)`, mensagem de `ServiceError` e de `Error`.
 * - `technical` — identificador: chave de objeto, import, className do Tailwind, comparação com
 *                 união de tipos, atributo `data-*`, nome de ícone, chave de tradução.
 * - `ambiguous` — o que sobra. É a fila de revisão manual, não um número a ignorar.
 *
 * Uso:
 *   npm run i18n:inventory            resumo por área
 *   npm run i18n:inventory -- --csv   linha a linha, para triagem
 *   npm run i18n:gate-ts              portão: falha se sobrar frase de usuário em `src/**\/*.ts`
 *
 * Grava `.planning/i18n-baseline.json`, que é o marco zero contra o qual o progresso das
 * ondas da Fase 6 se mede.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';
import ts from 'typescript';
import { globSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = resolve(ROOT, '.planning/i18n-baseline.json');

type Classification = 'user' | 'technical' | 'ambiguous';

type Finding = {
  file: string;
  line: number;
  text: string;
  classification: Classification;
  reason: string;
};

/** Props cujo valor é lido por gente, não por máquina. */
const USER_TEXT_PROPS = new Set([
  'label',
  'title',
  'placeholder',
  'description',
  'hint',
  'message',
  'heading',
  'subtitle',
  'caption',
  'emptyMessage',
  'errorMessage',
  'helperText',
  'confirmLabel',
  'cancelLabel',
  'aria-label',
  'alt',
]);

/** Props que parecem texto e são identificador. */
const TECHNICAL_PROPS = new Set([
  'className',
  'class',
  'id',
  'key',
  'name',
  'type',
  'role',
  'href',
  'to',
  'src',
  'path',
  'icon',
  'value',
  'testId',
  'data-testid',
  'htmlFor',
  'variant',
  'size',
  'color',
  'as',
]);

/**
 * Nome de campo é um sinal melhor que lista fixa: `emptyTitle`, `errorDescription` e
 * `tooltipText` não estavam em lista nenhuma e são todos texto de tela. O sufixo diz o papel.
 */
const USER_TEXT_SUFFIX = /(Label|Title|Description|Message|Text|Hint|Placeholder|Copy|Summary)$/;

function isUserTextProp(name: string): boolean {
  return USER_TEXT_PROPS.has(name) || USER_TEXT_SUFFIX.test(name);
}

const USER_TEXT_CALLS = new Set([
  'toast',
  'toast.success',
  'toast.error',
  'toast.info',
  'toast.warning',
  'toast.loading',
  'confirm',
  'alert',
]);

/**
 * O critério que decide se um literal é frase — e portanto o critério que decide se o número
 * final serve para planejar.
 *
 * A primeira versão só perguntava "tem letra?", e a fila de revisão veio com quinze mil linhas,
 * quase toda de identificador. Frase de interface tem duas marcas que identificador não tem:
 * **espaço entre palavras** e **caixa de sentença**. Uma palavra solta e minúscula neste
 * código é status, enum ou chave — `pending`, `documents`, `grid` — e nunca o que alguém lê.
 *
 * A exceção que precisa de regra própria é a lista de classes do Tailwind: tem espaço, tem
 * letra, e não é frase nenhuma. Reconhece-se por todos os tokens serem minúsculos com hífen,
 * dois-pontos ou colchete — vocabulário que português e inglês não usam.
 */
const TAILWIND_TOKEN = /^-?[a-z0-9]+(?:[-:/.[\]%()][a-z0-9-:/.[\]%()]*)*$/;

function looksLikeClassList(text: string): boolean {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.every((token) => TAILWIND_TOKEN.test(token));
}

function isProbablyProse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;

  /* Constante, caminho, URL, chave com dois-pontos: endereço, não texto. */
  if (/^[A-Z0-9_]+$/.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;
  if (/^[a-z0-9-]+\/[a-z0-9-/.]+$/i.test(trimmed)) return false;
  if (!trimmed.includes(' ') && /^[a-z0-9-]+:[a-z0-9-]/.test(trimmed)) return false;
  if (looksLikeClassList(trimmed)) return false;

  const hasSpace = /\s/.test(trimmed);
  const sentenceCase = /^[A-ZÀ-Ý]/.test(trimmed);
  const hasAccent = /[À-ÿ]/.test(trimmed);
  const endsWithPunctuation = /[.!?…:]$/.test(trimmed);

  /* Palavra solta só conta como frase se vier com acento ou caixa de sentença — `Salvar`
     conta, `grid` não. Com espaço, basta não ser lista de classes. */
  if (!hasSpace) return sentenceCase || hasAccent;
  return sentenceCase || hasAccent || endsWithPunctuation || trimmed.split(/\s+/).length > 2;
}

function callName(node: ts.CallExpression): string {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const target = expression.expression;
    const base = ts.isIdentifier(target) ? target.text : '';
    return base ? `${base}.${expression.name.text}` : expression.name.text;
  }
  return '';
}

/**
 * `'auth:review.field.terms'` é chave de catálogo, não frase.
 *
 * Depois da extração, os arquivos de dados guardam chave em `labelKey`, `titleKey` e afins — e
 * ela cai no mesmo campo `title`/`description` que antes carregava texto. Sem esta regra, o
 * inventário conta como pendente exatamente o que acabou de ser resolvido, e nunca chega a zero.
 * O `:` do namespace é o que distingue, e nenhuma frase de tela tem essa forma.
 */
const CHAVE_DE_CATALOGO = /^[a-z][a-zA-Z0-9]*:[\w.-]+$/;

/**
 * `throw new Error('useTheme deve ser usado dentro de ThemeProvider')` fala com quem escreve o
 * código, não com quem usa o app: é contrato de hook, e a mensagem só aparece se alguém montar a
 * árvore errada. Traduzir isso não ajuda ninguém e polui o catálogo.
 */
const ERRO_DE_PROGRAMACAO = /^use[A-Z]\w*\s/;

function classify(node: ts.Node, text: string): { classification: Classification; reason: string } {
  const parent = node.parent;
  if (!parent) return { classification: 'ambiguous', reason: 'sem contexto' };

  if (CHAVE_DE_CATALOGO.test(text)) {
    return { classification: 'technical', reason: 'chave de catálogo' };
  }

  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
    return { classification: 'technical', reason: 'especificador de módulo' };
  }
  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    return { classification: 'technical', reason: 'chave de objeto' };
  }
  if (ts.isLiteralTypeNode(parent)) {
    return { classification: 'technical', reason: 'tipo literal' };
  }
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) {
    return { classification: 'technical', reason: 'acesso por chave' };
  }
  /* `status === 'pending'` compara identificador, nunca frase. Idem `case 'grid':`. */
  if (ts.isBinaryExpression(parent) && ts.isToken(parent.operatorToken)) {
    return { classification: 'technical', reason: 'comparação' };
  }
  if (ts.isCaseClause(parent)) {
    return { classification: 'technical', reason: 'case de switch' };
  }

  /* `t('library.title')` é a chave, não o texto — e é o alvo da migração, não um achado. */
  if (ts.isCallExpression(parent)) {
    const name = callName(parent);
    if (name === 't' || name.endsWith('.t')) {
      return { classification: 'technical', reason: 'chave de tradução' };
    }
    if (USER_TEXT_CALLS.has(name)) {
      return { classification: 'user', reason: `argumento de ${name}()` };
    }
  }

  if (ts.isNewExpression(parent) && parent.expression.getText().endsWith('Error')) {
    const first = parent.arguments?.[0];
    if (first === node) {
      if (ERRO_DE_PROGRAMACAO.test(text)) {
        return { classification: 'technical', reason: 'contrato de hook' };
      }
      return { classification: 'user', reason: 'mensagem de erro' };
    }
  }

  if (ts.isJsxAttribute(parent.parent ?? parent)) {
    const attribute = (ts.isJsxAttribute(parent) ? parent : parent.parent) as ts.JsxAttribute;
    const attributeName = attribute.name.getText();
    if (TECHNICAL_PROPS.has(attributeName)) {
      return { classification: 'technical', reason: `prop técnica ${attributeName}` };
    }
    if (isUserTextProp(attributeName)) {
      return { classification: 'user', reason: `prop de texto ${attributeName}` };
    }
    return { classification: 'ambiguous', reason: `prop ${attributeName}` };
  }

  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    const propertyName = parent.name.text;
    if (TECHNICAL_PROPS.has(propertyName)) {
      return { classification: 'technical', reason: `campo técnico ${propertyName}` };
    }
    if (isUserTextProp(propertyName)) {
      return { classification: 'user', reason: `campo de texto ${propertyName}` };
    }
  }

  if (!isProbablyProse(text)) {
    return { classification: 'technical', reason: 'não parece frase' };
  }

  return { classification: 'ambiguous', reason: 'literal solto' };
}

function collect(filePath: string): Finding[] {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true);
  const findings: Finding[] = [];
  const relativePath = relative(ROOT, filePath);

  function record(node: ts.Node, text: string, forced?: Classification, forcedReason?: string) {
    if (!text.trim()) return;
    const { classification, reason } = forced
      ? { classification: forced, reason: forcedReason ?? '' }
      : classify(node, text);
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      file: relativePath,
      line: line + 1,
      text: text.trim().slice(0, 120),
      classification,
      reason,
    });
  }

  function walk(node: ts.Node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      record(node, node.text);
    } else if (ts.isJsxText(node)) {
      /* Texto entre tags é sempre para leitura humana — é o caso mais puro de todos. */
      /* Separador solto — `·`, `—`, `/` entre elementos — é desenho, não texto. */
      if (isProbablyProse(node.text)) record(node, node.text, 'user', 'texto em JSX');
    } else if (ts.isTemplateExpression(node)) {
      const literal =
        node.head.text + node.templateSpans.map((span) => span.literal.text).join(' ');
      if (isProbablyProse(literal)) {
        /* Template com interpolação é o que o codemod da Fase 6 não sabe converter sozinho:
           vira mensagem ICU escrita à mão. Marcar agora evita descobrir depois. */
        record(node, literal, 'ambiguous', 'template com interpolação — ICU manual');
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  return findings;
}

function areaOf(file: string): string {
  const parts = file.split('/');
  if (parts[0] === 'src' && parts[1] === 'features') return `src/features/${parts[2]}`;
  if (parts[0] === 'src') return `src/${parts[1]}`;
  if (parts[0] === 'server') return `server/${parts[1] ?? ''}`;
  return parts[0] ?? file;
}

/**
 * O portão dos arquivos `.ts`, e por que ele não é uma regra de lint.
 *
 * O caminho óbvio seria estender `i18next/no-literal-string` para `.ts`, ao lado das pastas já
 * promovidas a `error`. Não funciona: aquela configuração roda em `mode: 'jsx-text-only'`, e num
 * arquivo sem JSX ela não acusa nada — estender o glob seria um portão que promete e não cobra.
 * O único modo que enxerga `.ts` é `mode: 'all'`, e medido sobre este repositório ele acusa 939
 * literais, quase todos identificador: chave de React Query, caminho de rota, comparação com
 * união de tipos, a própria chave de catálogo. Domar isso exigiria uma lista de exceção que
 * envelhece pior do que o problema que resolve.
 *
 * O classificador deste inventário já faz essa distinção — é a razão de ele existir — e depois
 * da extração ele reporta zero. Então o portão é ele: sai 1 se alguma frase de usuário voltar a
 * um `.ts` de `src/`, e imprime onde, para o conserto ser imediato.
 */
function gateTs(findings: Finding[]): number {
  const pendentes = findings.filter(
    (finding) =>
      finding.classification === 'user' &&
      finding.file.startsWith('src/') &&
      finding.file.endsWith('.ts'),
  );

  console.log('');
  console.log('Portão de strings em .ts');
  console.log('─'.repeat(74));
  if (!pendentes.length) {
    console.log('nenhuma frase de usuário em src/**/*.ts');
    console.log('─'.repeat(74));
    console.log('');
    console.log('OK.');
    return 0;
  }

  console.log(`${pendentes.length} frase(s) de usuário fora do catálogo:`);
  for (const pendente of pendentes) {
    console.log(`  ${pendente.file}:${pendente.line}  ${pendente.reason}  "${pendente.text}"`);
  }
  console.log('─'.repeat(74));
  console.log('');
  console.log('FALHOU.');
  return 1;
}

function main() {
  const emitCsv = process.argv.includes('--csv');
  const gate = process.argv.includes('--gate-ts');

  const files = [
    ...globSync('src/**/*.{ts,tsx}', { cwd: ROOT }),
    ...globSync('server/**/*.ts', { cwd: ROOT }),
    ...globSync('api/**/*.ts', { cwd: ROOT }),
  ]
    .filter((file) => !file.includes('/i18n/catalog/'))
    .map((file) => resolve(ROOT, file));

  const findings = files.flatMap(collect);

  if (gate) {
    process.exitCode = gateTs(findings);
    return;
  }

  if (emitCsv) {
    console.log('file,line,classification,reason,text');
    for (const finding of findings) {
      const text = finding.text.replace(/"/g, '""');
      console.log(
        `${finding.file},${finding.line},${finding.classification},${finding.reason},"${text}"`,
      );
    }
    return;
  }

  const byArea = new Map<string, { user: number; ambiguous: number; technical: number }>();
  for (const finding of findings) {
    const area = areaOf(finding.file);
    const bucket = byArea.get(area) ?? { user: 0, ambiguous: 0, technical: 0 };
    bucket[finding.classification] += 1;
    byArea.set(area, bucket);
  }

  const rows = [...byArea.entries()]
    .map(([area, counts]) => ({ area, ...counts, migrate: counts.user + counts.ambiguous }))
    .sort((a, b) => b.migrate - a.migrate);

  const totals = rows.reduce(
    (acc, row) => ({
      user: acc.user + row.user,
      ambiguous: acc.ambiguous + row.ambiguous,
      technical: acc.technical + row.technical,
      migrate: acc.migrate + row.migrate,
    }),
    { user: 0, ambiguous: 0, technical: 0, migrate: 0 },
  );

  const pad = (value: string | number, width: number) => String(value).padStart(width);
  console.log('');
  console.log('Inventário de strings — i18n Fase 0');
  console.log('─'.repeat(74));
  console.log(
    `${'área'.padEnd(34)}${pad('usuário', 9)}${pad('ambíguo', 9)}${pad('técnico', 9)}${pad('migrar', 9)}`,
  );
  console.log('─'.repeat(74));
  for (const row of rows) {
    if (row.migrate === 0) continue;
    console.log(
      `${row.area.padEnd(34)}${pad(row.user, 9)}${pad(row.ambiguous, 9)}${pad(row.technical, 9)}${pad(row.migrate, 9)}`,
    );
  }
  console.log('─'.repeat(74));
  console.log(
    `${'total'.padEnd(34)}${pad(totals.user, 9)}${pad(totals.ambiguous, 9)}${pad(totals.technical, 9)}${pad(totals.migrate, 9)}`,
  );
  console.log('');
  console.log(`${files.length} arquivos lidos. "migrar" = usuário + ambíguo.`);

  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        files: files.length,
        totals,
        areas: Object.fromEntries(rows.map((row) => [row.area, row])),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Baseline em ${relative(ROOT, BASELINE_PATH)}`);
}

main();
