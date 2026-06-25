/**
 * Etapa 4.0 — Audita e desativa registros de teste da Etapa 3.
 * Uso: npx tsx scripts/audit-etapa4-cleanup.mjs
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { getMongoDatabaseName } from '../server/db/database.ts';
import { DEV_COMPANY_ID } from '../server/db/constants.ts';

const OFFICIAL_GROUP_IDS = new Set([
  'group_juridico',
  'group_financeiro',
  'group_rh',
  'group_compras',
  'group_diretoria',
]);

const OFFICIAL_CLASS_IDS = new Set([
  'class_contract_supplier',
  'class_invoice',
  'class_purchase_order',
  'class_confidentiality_agreement',
  'class_boleto',
  'class_commercial_proposal',
  'class_internal_policy',
]);

const OFFICIAL_RULE_IDS = new Set([
  'rule_contract_supplier_v1',
  'rule_invoice_v1',
  'rule_purchase_order_v1',
  'rule_confidentiality_agreement_v1',
  'rule_boleto_v1',
  'rule_commercial_proposal_v1',
  'rule_internal_policy_v1',
]);

function isTestRecord(id, name) {
  if (id.startsWith('group_qualidade')) return true;
  if (id.startsWith('class_relatorio_tecnico')) return true;
  if (id.startsWith('rule_relatorio_tecnico')) return true;
  const lower = (name ?? '').toLowerCase();
  if (lower.includes('qualidade qa') || lower === 'qualidade') return true;
  if (lower.includes('relatório técnico') || lower.includes('relatorio tecnico')) return true;
  return false;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI ausente');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(getMongoDatabaseName());
  const companyId = DEV_COMPANY_ID;
  const filter = { companyId };

  const report = { testFound: [], deactivated: [], officialActive: {} };

  for (const [collection, officialIds, activeField] of [
    ['access_groups', OFFICIAL_GROUP_IDS, 'active'],
    ['document_classes', OFFICIAL_CLASS_IDS, 'active'],
    ['document_rules', OFFICIAL_RULE_IDS, 'active'],
  ]) {
    const docs = await db.collection(collection).find(filter).toArray();

    for (const doc of docs) {
      const id = doc._id;
      const name = doc.name ?? doc.classId ?? '';
      const isOfficial = officialIds.has(id);
      const isTest = !isOfficial || isTestRecord(id, name);

      if (!isOfficial || isTestRecord(id, name)) {
        report.testFound.push({ collection, id, name: doc.name ?? doc.classId, active: doc[activeField] });
      }

      if (isTest && doc[activeField] !== false) {
        await db.collection(collection).updateOne(
          { _id: id, companyId },
          { $set: { [activeField]: false, updatedAt: new Date() } },
        );
        report.deactivated.push({ collection, id });
      }

      if (isOfficial && !isTestRecord(id, name) && doc[activeField] === false) {
        await db.collection(collection).updateOne(
          { _id: id, companyId },
          { $set: { [activeField]: true, updatedAt: new Date() } },
        );
        console.log(`Reativado oficial: ${collection}/${id}`);
      }
    }

    const activeOfficial = await db
      .collection(collection)
      .countDocuments({ companyId, [activeField]: true, _id: { $in: [...officialIds] } });
    report.officialActive[collection] = activeOfficial;
  }

  await client.close();

  console.log('\n=== Etapa 4.0 — Auditoria ===\n');
  console.log('Registros de teste encontrados:');
  for (const item of report.testFound) {
    console.log(`  [${item.collection}] ${item.id} — ${item.name} (active=${item.active})`);
  }
  console.log('\nDesativados (active=false):');
  for (const item of report.deactivated) {
    console.log(`  [${item.collection}] ${item.id}`);
  }
  console.log('\nOficiais ativos:');
  console.log(`  access_groups: ${report.officialActive.access_groups}/5`);
  console.log(`  document_classes: ${report.officialActive.document_classes}/7`);
  console.log(`  document_rules: ${report.officialActive.document_rules}/7`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
