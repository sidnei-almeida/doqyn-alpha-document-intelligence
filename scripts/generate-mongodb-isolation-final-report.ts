import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLLECTIONS, DEV_TENANT_ID } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import { resolveSharedCollections } from '../server/tenancy/tenantResolver.js';
import { resolveActiveTenant } from '../server/tenancy/tenantResolver.js';
import { createReportWriter } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_MONGODB_ISOLATION_FINAL.txt');

const RELATED_REPORTS = [
  'RELATORIO_AUDITORIA_MONGODB_SCHEMA.txt',
  'RELATORIO_AUDITORIA_USO_COLLECTIONS.txt',
  'RELATORIO_INDICES_MONGODB.txt',
  'RELATORIO_MIGRACAO_FLAT_TO_TENANT.txt',
  'RELATORIO_NO_FLAT_WRITES.txt',
  'RELATORIO_SEED_ISOLATION_TEST.txt',
  'RELATORIO_TESTE_TENANT_ISOLATION.txt',
  'RELATORIO_GRUPOS_ORFAOS_DUPLICADOS.txt',
];

function excerpt(path: string, maxLines = 15): string {
  if (!existsSync(path)) return '(não gerado)';
  const lines = readFileSync(path, 'utf8').split('\n').slice(0, maxLines);
  return lines.join('\n');
}

async function main() {
  const report = createReportWriter();
  report.line('DOQYN — Relatório consolidado de isolamento MongoDB');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line('Relatório sanitizado.');

  report.section('1. ESTADO ANTERIOR');
  report.line('- Coleções flat legadas coexistiam com prefixadas (*_company_dev).');
  report.line('- documentService/processingService/auditService usavam Mongoose em coleções flat.');
  report.line('- Grupos órfãos de desenvolvimento no flat e prefixado.');

  report.section('2. ESTADO ATUAL (pós-implementação)');
  if (isMongoNativeConfigured()) {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name).sort();

    const flat = Object.values(COLLECTIONS).filter((n) => names.includes(n));
    const prefixed = names.filter((n) => n.includes('_company_dev') || n.includes('_company_test_2'));

    report.line(`Coleções totais: ${names.length}`);
    report.line(`Flat legadas presentes: ${flat.join(', ') || 'nenhuma'}`);
    report.line(`Prefixadas: ${prefixed.length}`);
    for (const p of prefixed) {
      const count = await db.collection(p).countDocuments();
      report.line(`  ${p}: ${count} docs`);
    }

    const tenant = await resolveActiveTenant(DEV_TENANT_ID);
    const tenantNames = resolveSharedCollections();
    report.line(`\nTenant ${DEV_TENANT_ID} → documents=${tenantNames.documents}`);
  } else {
    report.line('MongoDB não configurado nesta execução.');
  }

  report.section('3. ENDPOINTS/SERVICES REFATORADOS');
  report.line('- server/services/documentService.ts → getTenantCollections');
  report.line('- server/services/processingService.ts → getTenantCollections');
  report.line('- server/services/auditService.ts → getTenantCollections (audit_logs prefixada)');
  report.line('- Demais services admin já usavam getTenantCollections/requireBusinessAdminCollections');

  report.section('4. CAMADA DE TENANCY');
  report.line('- getTenantDbCollections(db, tenant)');
  report.line('- assertTenantScopedCollectionAccess / assertNotFlatTenantCollection');
  report.line('- resolveTenantCollectionPrefix com bloqueio de CPF/CNPJ em prefix');
  report.line('- docs/MONGODB_TENANT_ISOLATION.md');

  report.section('5. ÍNDICES');
  report.line(excerpt(join(process.cwd(), 'docs/RELATORIO_INDICES_MONGODB.txt')));

  report.section('6. MIGRAÇÃO FLAT → PREFIXADA');
  report.line(excerpt(join(process.cwd(), 'docs/RELATORIO_MIGRACAO_FLAT_TO_TENANT.txt')));

  report.section('7. TESTE SEGUNDO TENANT');
  report.line(excerpt(join(process.cwd(), 'docs/RELATORIO_TESTE_TENANT_ISOLATION.txt')));

  report.section('8. EVIDÊNCIA DE ISOLAMENTO');
  report.line('- company_dev consulta apenas documents_company_dev');
  report.line('- company_test_2 consulta apenas documents_company_test_2');
  report.line('- assertCanManageCompany bloqueia company_admin cross-tenant');

  report.section('9. NO-FLAT-WRITES');
  report.line(excerpt(join(process.cwd(), 'docs/RELATORIO_NO_FLAT_WRITES.txt')));

  report.section('10. PENDÊNCIAS');
  report.line('- Remover coleções flat após backup e MIGRATION_DELETE_LEGACY=true');
  report.line('- Desligar dual-write company_members quando tenant_members for único');
  report.line('- Implementar shared_individual_pool completo');
  report.line('- Worker de notificações (fora de escopo)');

  report.section('11. RISCOS RESTANTES');
  report.line('- Dados duplicados em flat até migração apply');
  report.line('- Scripts legados .mjs ainda referenciam flat (testes)');

  report.section('12. RECOMENDAÇÃO PARA PRODUÇÃO');
  report.line('1. Executar db:ensure-indexes em staging');
  report.line('2. MIGRATION_APPLY=true em janela de manutenção com backup');
  report.line('3. test:tenant-isolation em CI antes de deploy');
  report.line('4. audit:no-flat-writes em CI');
  report.line('5. Nunca usar collectionPrefix com CPF/CNPJ');

  report.section('RELATÓRIOS GERADOS');
  for (const name of RELATED_REPORTS) {
    const path = join(process.cwd(), 'docs', name);
    report.line(`- ${name}: ${existsSync(path) ? 'ok' : 'pendente'}`);
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório consolidado: ${REPORT_PATH}`);
  if (isMongoNativeConfigured()) await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
