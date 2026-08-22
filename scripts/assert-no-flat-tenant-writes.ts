import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { COLLECTIONS } from '../server/db/constants.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_NO_FLAT_WRITES.txt');

/**
 * Nomes de coleção de dados de tenant.
 *
 * Quando cada tenant tinha suas próprias coleções, escrever nestes nomes "chapados" significava
 * gravar fora do tenant. Desde o Passo 7 eles **são** as coleções reais — e por isso a checagem
 * ficou mais importante, não menos: escrever via `db.collection('documents').updateOne(...)` agora
 * grava no pool compartilhado sem passar por `getTenantCollections`, ou seja, sem escopo de
 * tenant. Toda escrita em dado de tenant tem que vir do handle escopado.
 */
const FLAT = new Set(Object.values(COLLECTIONS));

const ALLOWED_PATH_PATTERNS = [
  /scripts\/migrate-flat/,
  /scripts\/audit-mongodb/,
  /scripts\/audit-collection-usage/,
  /scripts\/ensure-mongodb-indexes/,
  /scripts\/cleanup-dev-orphan/,
  /scripts\/seed-second-tenant/,
  /scripts\/test-tenant-isolation/,
  /scripts\/assert-no-flat/,
  /scripts\/test-/,
  /scripts\/validate-flow/,
  /scripts\/audit-etapa/,
  /server\/db\/setupMongo/,
  /server\/tenancy\//,
  /server\/db\/constants/,
  /server\/models\//,
  /server\/db\/mongo\.ts/,
];

const WRITE_PATTERNS = [
  /db\.collection\(\s*['"]([\w_]+)['"]\s*\)\.(insert|update|replace|delete|bulkWrite|findOneAndUpdate|updateOne|updateMany|deleteOne|deleteMany|replaceOne)/,
  /\.collection\(\s*['"]([\w_]+)['"]\s*\)\.(insert|update|replace|delete|bulkWrite|findOneAndUpdate|updateOne|updateMany|deleteOne|deleteMany|replaceOne)/,
  /(DocumentModel|DocumentVersionModel|ProcessingJobModel|AuditEventModel)\.(create|insertMany|findByIdAndUpdate|updateOne|deleteOne)/,
];

type Violation = { file: string; line: number; snippet: string };

const violations: Violation[] = [];
const exceptions: string[] = [];

function isAllowed(file: string): boolean {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  return ALLOWED_PATH_PATTERNS.some((p) => p.test(rel));
}

function scanFile(filePath: string) {
  const rel = relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (!rel.startsWith('server/') && !rel.startsWith('api/')) return;
  if (isAllowed(filePath)) {
    exceptions.push(rel);
    return;
  }

  const lines = readFileSync(filePath, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of WRITE_PATTERNS) {
      const match = pattern.exec(line);
      if (!match) continue;
      const collection = match[1];
      if (collection && FLAT.has(collection)) {
        violations.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 100) });
      }
      if (match[0].includes('Model')) {
        violations.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 100) });
      }
    }
  }
}

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full);
    } else if (/\.tsx?$/.test(entry)) {
      scanFile(full);
    }
  }
}

function main() {
  walk(join(process.cwd(), 'server'));
  walk(join(process.cwd(), 'api'));

  const report = createReportWriter();
  report.line('DOQYN — Verificação de writes em coleções flat tenant-scoped');
  report.line(`Data: ${new Date().toISOString()}`);

  report.section('RESULTADO');
  if (violations.length === 0) {
    report.line('PASS — Nenhum fluxo produtivo escreve em coleções flat tenant-scoped.');
  } else {
    report.line(`FAIL — ${violations.length} violação(ões) encontrada(s).`);
    for (const v of violations) {
      report.line(`  ${v.file}:${v.line}`);
      report.line(`    ${v.snippet}`);
    }
  }

  report.section('EXCEÇÕES DOCUMENTADAS (caminhos ignorados)');
  for (const e of [...new Set(exceptions)].sort()) {
    report.line(`  ${e}`);
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(violations.length === 0 ? 'PASS' : `FAIL (${violations.length})`);
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
