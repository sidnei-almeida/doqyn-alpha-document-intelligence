import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { COLLECTIONS, REGISTRY_COLLECTIONS, SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_AUDITORIA_USO_COLLECTIONS.txt');

const TENANT_SCOPED = new Set(Object.values(COLLECTIONS));
const REGISTRY = new Set(Object.values(REGISTRY_COLLECTIONS));
const SHARED_APP = new Set(Object.values(SHARED_APP_COLLECTIONS));

const SCAN_DIRS = ['server', 'api', 'src', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

type Classification =
  | 'OK_GLOBAL_REGISTRY'
  | 'OK_SHARED_APP'
  | 'OK_MIGRATION_SCRIPT'
  | 'OK_TEST_OR_MOCK'
  | 'OK_TENANCY_LAYER'
  | 'OK_DOCUMENTATION'
  | 'RISK_TENANT_SCOPED_FLAT_COLLECTION'
  | 'NEEDS_REFACTOR';

type Occurrence = {
  file: string;
  line: number;
  collection: string;
  classification: Classification;
  snippet: string;
  recommendation: string;
  needsGetTenantCollections: boolean;
};

const occurrences: Occurrence[] = [];

function classify(file: string, collection: string, snippet: string): Occurrence {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const lower = rel.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();

  let classification: Classification = 'RISK_TENANT_SCOPED_FLAT_COLLECTION';
  let recommendation = 'Substituir por getTenantCollections(tenantId).';
  let needsGetTenantCollections = true;

  if (lower.startsWith('api/') && lowerSnippet.includes('resource:')) {
    classification = 'OK_DOCUMENTATION';
    recommendation = 'Metadata de log de API — não é acesso MongoDB direto.';
    needsGetTenantCollections = false;
  } else if (REGISTRY.has(collection)) {
    classification = 'OK_GLOBAL_REGISTRY';
    recommendation = 'Uso permitido — coleção de registry global.';
    needsGetTenantCollections = false;
  } else if (SHARED_APP.has(collection)) {
    classification = 'OK_SHARED_APP';
    recommendation = 'Uso permitido — coleção SHARED_APP (assinaturas, shares, analysis_jobs, etc.).';
    needsGetTenantCollections = false;
  } else if (
    lower.includes('migrate-flat') ||
    lower.includes('audit-mongodb') ||
    lower.includes('cleanup-dev-orphan') ||
    lower.includes('seed-second-tenant') ||
    lower.includes('ensure-mongodb-indexes') ||
    lower.includes('test-tenant-isolation') ||
    lower.includes('assert-no-flat')
  ) {
    classification = 'OK_MIGRATION_SCRIPT';
    recommendation = 'Script operacional — acesso legado permitido com dry-run.';
    needsGetTenantCollections = false;
  } else if (
    lower.includes('test-') ||
    lower.includes('validate-flow') ||
    lower.includes('mock') ||
    lower.includes('.mjs')
  ) {
    classification = 'OK_TEST_OR_MOCK';
    recommendation = 'Teste/mock — atualizar para coleções prefixadas quando possível.';
    needsGetTenantCollections = false;
  } else if (
    lower.includes('tenancy/') ||
    lower.includes('constants.ts') ||
    lower.includes('collectionguard') ||
    lower.includes('gettenantcollections')
  ) {
    classification = 'OK_TENANCY_LAYER';
    recommendation = 'Camada de tenancy — define nomes base, não acessa dados flat em runtime.';
    needsGetTenantCollections = false;
  } else if (lower.startsWith('docs/') || lower.endsWith('.md')) {
    classification = 'OK_DOCUMENTATION';
    recommendation = 'Documentação.';
    needsGetTenantCollections = false;
  } else if (
    lower.includes('setupmongo') &&
    (lowerSnippet.includes('resolvedtenantcollectionnames') || lowerSnippet.includes('names.'))
  ) {
    classification = 'OK_MIGRATION_SCRIPT';
    recommendation = 'Setup usa as coleções compartilhadas via resolveSharedCollections.';
    needsGetTenantCollections = false;
  } else if (
    lower.includes('/api/') &&
    (lowerSnippet.includes('resource:') || lowerSnippet.includes('logger.'))
  ) {
    classification = 'OK_DOCUMENTATION';
    recommendation = 'Metadata de log de API — não é acesso MongoDB direto.';
    needsGetTenantCollections = false;
  } else if (lower.includes('features/') && lower.includes('.tsx')) {
    classification = 'OK_TEST_OR_MOCK';
    recommendation = 'React Query key — não é coleção MongoDB.';
    needsGetTenantCollections = false;
  }

  return {
    file: rel,
    line: 0,
    collection,
    classification,
    snippet: snippet.trim().slice(0, 120),
    recommendation,
    needsGetTenantCollections,
  };
}

const PATTERNS = [
  /db\.collection\(\s*['"]([\w_]+)['"]/g,
  /collection\(\s*['"]([\w_]+)['"]/g,
  /['"](documents|document_versions|document_rules|document_classes|access_groups|processing_jobs|audit_logs)['"]/g,
];

function scanFile(filePath: string) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('MONGODB_URI')) continue;

    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const collection = match[1];
        if (!TENANT_SCOPED.has(collection) && !REGISTRY.has(collection) && !SHARED_APP.has(collection)) continue;

        const occ = classify(filePath, collection, line);
        occ.line = i + 1;
        occurrences.push(occ);
      }
    }
  }
}

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(full);
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      scanFile(full);
    }
  }
}

function main() {
  for (const dir of SCAN_DIRS) {
    walk(join(process.cwd(), dir));
  }

  const report = createReportWriter();
  report.line('DOQYN — Auditoria de uso de coleções MongoDB no código');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line('Relatório sanitizado — sem URI, secrets ou PII.');

  const risks = occurrences.filter((o) => o.classification === 'RISK_TENANT_SCOPED_FLAT_COLLECTION');
  const needsRefactor = occurrences.filter((o) => o.needsGetTenantCollections);

  report.section('RESUMO');
  report.line(`Ocorrências analisadas: ${occurrences.length}`);
  report.line(`Risco flat tenant-scoped: ${risks.length}`);
  report.line(`Precisam getTenantCollections: ${needsRefactor.length}`);

  report.section('DETALHES POR ARQUIVO');
  const byFile = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const list = byFile.get(occ.file) ?? [];
    list.push(occ);
    byFile.set(occ.file, list);
  }

  for (const [file, items] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    report.line(`\n-- ${file}`);
    for (const item of items) {
      report.line(`   L${item.line} | ${item.collection} | ${item.classification}`);
      report.line(`   Recomendação: ${item.recommendation}`);
      if (item.needsGetTenantCollections) {
        report.line('   → Trocar por getTenantCollections(tenantId)');
      }
    }
  }

  report.section('RISCOS (flat tenant-scoped em código produtivo)');
  if (risks.length === 0) {
    report.line('Nenhum risco identificado em server/api.');
  } else {
    for (const r of risks) {
      report.line(`[${r.classification}] ${r.file}:${r.line} — ${r.collection}`);
    }
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório gerado: ${REPORT_PATH}`);
  console.log(`Ocorrências: ${occurrences.length} | Riscos: ${risks.length}`);
}

main();
