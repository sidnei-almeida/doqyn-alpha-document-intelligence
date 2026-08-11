import 'dotenv/config';
import { join } from 'node:path';
import { DEV_TENANT_ID } from '../server/db/constants.js';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import { resolveActiveTenant } from '../server/tenancy/tenantResolver.js';
import { getTenantCollections } from '../server/tenancy/getTenantCollections.js';
import { tenantScopeFilter } from '../server/tenancy/tenantQuery.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_GRUPOS_ORFAOS_DUPLICADOS.txt');

const OFFICIAL_SLUGS = new Set([
  'juridico',
  'financeiro',
  'rh',
  'compras',
  'diretoria',
  'qualidade',
]);

type GroupFinding = {
  collection: string;
  groupId: string;
  slug: string;
  name: string;
  referenced: boolean;
  duplicateOf?: string;
  suggestion: 'manter' | 'marcar_inactive' | 'arquivar' | 'deletar_sugerido';
};

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = isApplyFlag('CLEANUP_APPLY');
  const tenantId = DEV_TENANT_ID;
  await resolveActiveTenant(tenantId);
  const { accessGroups, documentRules, names } = await getTenantCollections(tenantId);
  const db = await getDb();

  if (!accessGroups) {
    console.error('Access groups não disponíveis para este tenant.');
    process.exit(1);
  }

  const members = await db
    .collection('tenant_members')
    .find({ ...tenantScopeFilter(tenantId) })
    .toArray();

  const referencedIds = new Set<string>();
  for (const m of members) {
    for (const gid of m.accessGroupIds ?? []) referencedIds.add(gid);
  }

  const rules = await documentRules!.find({ ...tenantScopeFilter(tenantId) }).toArray();
  for (const rule of rules) {
    // MongoDocumentAccessRule guarda um grupo por regra (groupId), não uma lista.
    if (rule.groupId) referencedIds.add(rule.groupId);
  }

  const classes = await db.collection(names.documentClasses!).find({ ...tenantScopeFilter(tenantId) }).toArray();
  for (const cls of classes) {
    for (const gid of cls.notifyGroups ?? []) referencedIds.add(gid);
    for (const perm of Object.values(cls.permissions ?? {})) {
      if (Array.isArray(perm)) for (const gid of perm) referencedIds.add(gid);
    }
  }

  const groups = await accessGroups.find({ ...tenantScopeFilter(tenantId) }).toArray();
  const bySlug = new Map<string, typeof groups>();
  for (const g of groups) {
    const list = bySlug.get(g.slug) ?? [];
    list.push(g);
    bySlug.set(g.slug, list);
  }

  const findings: GroupFinding[] = [];

  for (const g of groups) {
    const referenced = referencedIds.has(g._id);
    const isOfficial = OFFICIAL_SLUGS.has(g.slug.replace(/^group_/, ''));
    const isRandomSuffix = /group_qualidade_[a-z0-9]{3,}$/i.test(g._id) || /_[a-z0-9]{4}$/.test(g.slug);

    let suggestion: GroupFinding['suggestion'] = 'manter';
    let duplicateOf: string | undefined;

    if (!referenced && isRandomSuffix) {
      suggestion = 'deletar_sugerido';
    } else if (!referenced && !isOfficial) {
      suggestion = 'marcar_inactive';
    } else if (!referenced && isOfficial) {
      suggestion = 'manter';
    }

    const slugPeers = bySlug.get(g.slug) ?? [];
    if (slugPeers.length > 1) {
      const official = slugPeers.find((p) => OFFICIAL_SLUGS.has(p.slug) && !/_[a-z0-9]{4}$/.test(p._id));
      if (official && official._id !== g._id) {
        duplicateOf = official._id;
        if (!referenced) suggestion = 'arquivar';
      }
    }

    findings.push({
      collection: names.accessGroups!,
      groupId: g._id,
      slug: g.slug,
      name: g.name,
      referenced,
      duplicateOf,
      suggestion,
    });
  }

  let applied = 0;
  if (apply) {
    for (const f of findings) {
      if (f.suggestion === 'marcar_inactive' && !f.referenced) {
        await accessGroups.updateOne({ _id: f.groupId }, { $set: { active: false, updatedAt: new Date() } });
        applied += 1;
      }
    }
  }

  const report = createReportWriter();
  report.line('DOQYN — Grupos órfãos e duplicados (dev)');
  report.line(`Data: ${new Date().toISOString()}`);
  report.line(`Database: ${getMongoDatabaseName()}`);
  report.line(`Tenant: ${tenantId}`);
  report.line(`Modo: ${apply ? 'CLEANUP_APPLY' : 'DRY-RUN'}`);
  report.line('Grupos oficiais (jurídico, financeiro, RH, compras, diretoria, qualidade) nunca são apagados automaticamente.');

  report.section('RESUMO');
  report.line(`Grupos analisados: ${findings.length}`);
  report.line(`Órfãos: ${findings.filter((f) => !f.referenced).length}`);
  report.line(`Duplicados sugeridos: ${findings.filter((f) => f.duplicateOf).length}`);
  report.line(`Ações aplicadas: ${applied}`);

  report.section('DETALHES');
  for (const f of findings) {
    report.line(
      `${f.groupId} | slug=${f.slug} | ref=${f.referenced ? 'sim' : 'não'} | sugestão=${f.suggestion}${f.duplicateOf ? ` | dup de ${f.duplicateOf}` : ''}`,
    );
  }

  if (!apply) {
    report.section('PRÓXIMO PASSO');
    report.line('CLEANUP_APPLY=true npm run db:cleanup-orphan-groups');
    report.line('Apenas grupos não oficiais órfãos serão marcados inactive.');
  }

  report.section('FIM');
  report.write(REPORT_PATH);

  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(`Órfãos: ${findings.filter((f) => !f.referenced).length} | Aplicados: ${applied}`);

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeMongoConnection();
  process.exit(1);
});
