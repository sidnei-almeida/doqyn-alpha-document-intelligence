/**
 * Auditoria dos códigos de erro de serviço (Fase 3 do `.planning/I18N-PLANO.md`).
 *
 * O plano se apoia numa aposta: as ~490 chamadas `new ServiceError(mensagem, code, status)` já
 * carregam um `code` legível por máquina, então a mensagem em português pode sair do servidor e
 * virar responsabilidade do catálogo do front. Isso só vale se os códigos forem de fato
 * distinguíveis — e é isso que este script mede antes de qualquer refatoração.
 *
 * Três coisas que ele procura:
 *
 * - **Código com mais de uma mensagem.** O mesmo `code` dizendo coisas diferentes em pontos
 *   diferentes significa que traduzir por código perderia informação. Cada caso é uma decisão:
 *   ou as mensagens eram a mesma coisa dita de dois jeitos, ou faltava um código.
 * - **Mensagem com interpolação.** `${nome}` no meio da frase vira `params` no contrato novo;
 *   quem não tem interpolação é tradução direta.
 * - **Código repetido com status HTTP diferente.** Sinal de que o mesmo nome cobre situações
 *   que o cliente precisa distinguir.
 *
 * Uso:
 *   npm run i18n:error-codes             resumo e conflitos
 *   npm run i18n:error-codes -- --json   despejo completo, para gerar o catálogo
 */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { globSync } from 'node:fs';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..');

type Occurrence = {
  file: string;
  line: number;
  code: string;
  message: string;
  /** `true` quando a mensagem é template com interpolação — vira `params` no contrato novo. */
  interpolated: boolean;
  statusCode: string | null;
};

function literalText(node: ts.Expression): { text: string; interpolated: boolean } | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, interpolated: false };
  }
  if (ts.isTemplateExpression(node)) {
    const text =
      node.head.text +
      node.templateSpans
        .map((span) => `{${span.expression.getText()}}${span.literal.text}`)
        .join('');
    return { text, interpolated: true };
  }
  return null;
}

function collect(filePath: string): Occurrence[] {
  const source = readFileSync(filePath, 'utf8');
  if (!source.includes('ServiceError')) return [];

  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true);
  const found: Occurrence[] = [];
  const relativePath = relative(ROOT, filePath);

  function walk(node: ts.Node) {
    if (ts.isNewExpression(node) && node.expression.getText() === 'ServiceError') {
      const [messageArg, codeArg, statusArg] = node.arguments ?? [];
      const message = messageArg ? literalText(messageArg) : null;
      const code =
        codeArg && (ts.isStringLiteral(codeArg) || ts.isNoSubstitutionTemplateLiteral(codeArg))
          ? codeArg.text
          : null;

      if (code) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        found.push({
          file: relativePath,
          line: line + 1,
          code,
          message: message?.text ?? '(dinâmica)',
          interpolated: message?.interpolated ?? true,
          statusCode: statusArg ? statusArg.getText() : null,
        });
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  return found;
}

function main() {
  const asJson = process.argv.includes('--json');

  const files = [
    ...globSync('server/**/*.ts', { cwd: ROOT }),
    ...globSync('api/**/*.ts', { cwd: ROOT }),
    ...globSync('shared/**/*.ts', { cwd: ROOT }),
  ].map((file) => resolve(ROOT, file));

  const occurrences = files.flatMap(collect);

  const byCode = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    const list = byCode.get(occurrence.code) ?? [];
    list.push(occurrence);
    byCode.set(occurrence.code, list);
  }

  const conflicts = [...byCode.entries()]
    .map(([code, list]) => ({
      code,
      messages: [...new Set(list.map((o) => o.message))],
      statuses: [...new Set(list.map((o) => o.statusCode).filter(Boolean))],
      uses: list.length,
      files: [...new Set(list.map((o) => o.file))],
    }))
    .filter((entry) => entry.messages.length > 1 || entry.statuses.length > 1)
    .sort((a, b) => b.messages.length - a.messages.length);

  if (asJson) {
    console.log(JSON.stringify({ occurrences, conflicts }, null, 2));
    return;
  }

  const interpolated = occurrences.filter((o) => o.interpolated);
  const dynamic = occurrences.filter((o) => o.message === '(dinâmica)');

  console.log('');
  console.log('Códigos de erro de serviço — i18n Fase 3');
  console.log('─'.repeat(74));
  console.log(`chamadas de ServiceError com code literal   ${occurrences.length}`);
  console.log(`códigos distintos                          ${byCode.size}`);
  console.log(`mensagens com interpolação (viram params)   ${interpolated.length}`);
  console.log(`mensagens não literais (revisão manual)     ${dynamic.length}`);
  console.log(`códigos em conflito                        ${conflicts.length}`);
  console.log('─'.repeat(74));

  if (conflicts.length > 0) {
    console.log('');
    console.log('Conflitos — mesmo código, mensagens ou status diferentes:');
    console.log('');
    for (const conflict of conflicts.slice(0, 25)) {
      console.log(`  ${conflict.code}  (${conflict.uses} usos, ${conflict.files.length} arquivos)`);
      for (const message of conflict.messages.slice(0, 4)) {
        console.log(`    · ${message.slice(0, 92)}`);
      }
      if (conflict.statuses.length > 1) {
        console.log(`    status: ${conflict.statuses.join(', ')}`);
      }
    }
    if (conflicts.length > 25) {
      console.log(`  … e mais ${conflicts.length - 25}.`);
    }
  }
  console.log('');
}

main();
