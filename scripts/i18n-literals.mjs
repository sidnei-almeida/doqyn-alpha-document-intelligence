// Uso: node scripts/i18n-literals.mjs <arquivo|pasta>...
// Lista literais que parecem texto de tela: fora de t(), className, import, comparação e afins.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const TECH_ATTRS = new Set([
  'className', 'class', 'id', 'key', 'to', 'href', 'src', 'type', 'name', 'variant', 'size', 'tone',
  'role', 'target', 'rel', 'as', 'align', 'side', 'placement', 'layout', 'mode', 'method', 'value',
  'autoComplete', 'inputMode', 'icon', 'iconName', 'testId', 'overlayTestId', 'closeTestId',
  'zIndexClass', 'bodyClassName', 'wrapperClassName', 'containerClassName', 'contentClassName',
  'headerClassName', 'itemClassName', 'iconClassName', 'triggerClassName', 'panelClassName',
  'headerClassName', 'fill', 'stroke', 'd', 'viewBox', 'width', 'height', 'color', 'accept',
  'aria-hidden', 'aria-busy', 'aria-live', 'aria-controls', 'aria-describedby', 'aria-labelledby',
  'aria-haspopup', 'aria-current', 'aria-expanded', 'aria-pressed', 'aria-selected', 'htmlFor',
  'fontFamily', 'fontSize', 'decoding', 'loading', 'draggable', 'spellCheck', 'enterKeyHint',
]);
const TECH_PROPS = new Set([
  ...TECH_ATTRS, 'queryKey', 'path', 'url', 'endpoint', 'status', 'code', 'kind', 'tone', 'variant',
  'imagePath', 'field', 'sortKey', 'icon', 'format', 'mimeType', 'headerClassName', 'cellClassName',
  'titleKey', 'labelKey', 'descriptionKey', 'messageKey', 'hintKey', 'reasonKey', 'action',
]);
const PT_WORD = /(^|[^a-zà-ÿ])(de|do|da|dos|das|para|não|nao|você|voce|com|seu|sua|um|uma|em|no|na|ao|ou|foi|está|este|esta|isso|aqui|ainda|já|pelo|pela|quem|nenhum|nenhuma|todos|todas|sem|mais|por|os|as|e|o|a)([^a-zà-ÿ]|$)/i;

function looksLikeClassList(text) {
  const tokens = text.trim().split(/\s+/);
  return tokens.length > 0 && tokens.every((tok) => /^-?[a-z0-9!]+([-:/.[\]%()#,_][a-z0-9-:/.[\]%()#,_]*)*$/.test(tok));
}

function isProse(text) {
  const s = text.trim();
  if (s.length < 2) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  if (/^[a-z]+:[\w.-]+$/.test(s)) return false; // chave com namespace
  if (/^[\w-]+(\.[\w-]+)+$/.test(s) && !/\s/.test(s)) return false; // chave pontuada / arquivo
  if (/^https?:|^\/|^#|^\.\.?\//.test(s)) return false;
  if (/^[A-Z0-9_]+$/.test(s)) return false;
  if (looksLikeClassList(s) && !/[À-ÿ]/.test(s)) return false;
  if (/[À-ÿ]/.test(s)) return true;
  if (/\s/.test(s)) return /[A-Za-z]{2,}/.test(s);
  const word = s.replace(/[.…!?:]+$/, '');
  if (/^[A-Z][a-zà-ÿ]+$/.test(word)) return true;
  if (s !== word && /^[a-z]{3,}$/.test(word)) return true;
  // Palavra solta em minúscula: só conta com cara de português, senão é enum ou chave.
  if (/^[a-zà-ÿ]{4,}$/.test(word)) {
    return /(ção|ções|mento|ado|ada|ido|ida|agem|dade|ência|ável|ível|nh|lh)$|nh|lh/.test(word) ||
      /^(agora|hoje|ontem|pedido|acesso|arquivo|documento|pasta|categoria|grupo|usuário|pessoa|todos|todas|nenhum|sim|não|valor|nome|lista|grade|ativo|pendente)$/.test(word);
  }
  return PT_WORD.test(` ${s} `) && /[a-z]{3,}/.test(s);
}

function callName(node) {
  const e = node.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return `${e.expression.getText()}.${e.name.text}`;
  return '';
}

function skip(node) {
  let p = node.parent;
  if (!p) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isBinaryExpression(p) && /===|!==|==|!=|in/.test(p.operatorToken.getText())) return true;
  if (ts.isCaseClause(p)) return true;
  // subir por parênteses, ternários e ?? até achar o contexto que decide
  let ctx = node;
  while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || (ts.isBinaryExpression(p) && /\?\?|\|\|/.test(p.operatorToken.getText())) || ts.isJsxExpression(p) || ts.isAsExpression(p))) {
    ctx = p;
    p = p.parent;
  }
  if (!p) return false;
  if (ts.isCallExpression(p)) {
    const n = callName(p);
    if (n === 't' || n.endsWith('.t') || n === 'useTranslation' || n === 'cn' || n === 'clsx' || n === 'require' || n.startsWith('console.') || /^(logger|pipelineDebug)/.test(n) || n === 'getItem' || n.endsWith('.getItem') || n.endsWith('.setItem') || n.endsWith('.removeItem') || n.endsWith('.get') || n.endsWith('.has') || n.endsWith('.set') || n.endsWith('addEventListener') || n.endsWith('removeEventListener') || n.endsWith('querySelector') || n.endsWith('getElementById') || n.endsWith('createElement') || n.endsWith('.includes') || n.endsWith('.startsWith') || n.endsWith('.endsWith') || n.endsWith('.split') || n.endsWith('.join') || n.endsWith('.replace') || n.endsWith('.match') || n.endsWith('.test') || n === 'Symbol' || n.endsWith('.append') || n.endsWith('.setAttribute') || n.endsWith('.getAttribute') || n === 'fetch' || n === 'authFetch' || n.endsWith('.localeCompare') || n.endsWith('.toLocaleString') || n.endsWith('.toLocaleDateString') || n === 'navigate' || n.endsWith('.dispatchEvent') || n === 'CustomEvent' || n.endsWith('.toLowerCase')) return true;
  }
  if (ts.isNewExpression(p) && /Intl\.|URL|RegExp|CustomEvent|Event|Date/.test(p.expression.getText())) return true;
  if (ts.isJsxAttribute(p)) return TECH_ATTRS.has(p.name.getText()) || p.name.getText().startsWith('data-');
  if (ts.isPropertyAssignment(p)) {
    const name = p.name.getText().replace(/['"]/g, '');
    if (TECH_PROPS.has(name) || /ClassName$|Class$|TestId$|Key$|Id$|Path$|Url$|Icon$/.test(name)) return true;
  }
  if (ts.isVariableDeclaration(p)) {
    const name = p.name.getText();
    if (/(_KEY|Key|_ROUTE|Route|_PATH|Path|_URL|Url|ClassName|CLASS|_ID|Id|Pattern|REGEX|Regex|STORAGE|Storage|EVENT|Event|Selector|SELECTOR)$/.test(name)) return true;
  }
  if (ts.isDecorator(p)) return true;
  return false;
}

function scan(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const add = (node, text) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push(`${path.relative(process.cwd(), file)}:${line}: ${text.replace(/\s+/g, ' ').trim().slice(0, 140)}`);
  };
  const walk = (node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isProse(node.text) && !skip(node)) add(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      const text = node.head.text + node.templateSpans.map((s) => `{} ${s.literal.text}`).join('');
      const words = text.replace(/\{\}/g, ' ');
      if (isProse(words) && /[A-Za-zÀ-ÿ]{3,}/.test(words) && !skip(node) && !looksLikeClassList(words)) add(node, `\`${text}\``);
    } else if (ts.isJsxText(node) && isProse(node.text)) add(node, `<jsx> ${node.text}`);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

function expand(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { recursive: true })
    .map((f) => path.join(target, f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('/i18n/catalog/') && !f.endsWith('.d.ts'));
}

const files = process.argv.slice(2).flatMap(expand);
const lines = files.flatMap(scan);
console.log(lines.join('\n'));
console.error(`${lines.length} achados em ${files.length} arquivos`);
