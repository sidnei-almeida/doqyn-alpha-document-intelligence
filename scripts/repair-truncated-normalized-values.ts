/**
 * Repara `normalizedValue` decapitado pelo bug do rótulo "no".
 *
 * `FIELD_LABEL_PREFIX` juntava a letra "o" com os ordinais tipográficos (`n[ºo°]`), sem fronteira
 * de palavra e com a flag `i`. Qualquer valor de texto com as letras "no" nos primeiros trinta
 * caracteres perdia tudo até ali:
 *
 *   MERIDIANO SOFTWORKS LTDA.  ->  SOFTWORKS LTDA.
 *   NORTIS ENGENHARIA S.A.     ->  RTIS ENGENHARIA S.A.
 *
 * O estrago foi silencioso porque `value` guardava o literal do documento, correto — só
 * `normalizedValue` saía mutilado. E é `normalizedValue` que busca, ordena, compara e alerta: o
 * dado certo está gravado e não é achável. Buscar por "Nortis" não devolve o documento da Nortis.
 *
 * O reparo é exato, não é chute. Para campo de texto, `applyFieldNormalization` deriva
 * `normalizedValue` de `value` por função pura — então recomputar com a versão corrigida devolve
 * o valor que deveria estar lá desde o começo. Nenhuma chamada a modelo, nenhum documento relido.
 *
 * Dry-run por padrão:
 *   npx tsx scripts/repair-truncated-normalized-values.ts
 * Aplicar:
 *   npx tsx scripts/repair-truncated-normalized-values.ts --apply
 *
 * Depois de aplicar, rode `npm run db:backfill-search-meta -- --apply`: `searchMeta.people` e
 * `metadataIndex` são projeções de `document_versions.metadata` e carregam o mesmo estrago.
 */
import 'dotenv/config';
import { join } from 'node:path';
import type { Db } from 'mongodb';
import { getMongoDatabaseName } from '../server/db/database.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoDocumentVersion, MongoVersionMetadataField } from '../server/db/types.js';
import { normalizeStringFieldValue } from '../server/ai/services/documentValidators.js';
import { resolveSharedCollections } from '../server/tenancy/tenantStorage.js';
import { createReportWriter, isApplyFlag } from './lib/reportUtils.js';

const REPORT_PATH = join(process.cwd(), 'docs/RELATORIO_REPARO_NORMALIZED_VALUE.txt');

function hasApplyArg(): boolean {
  return process.argv.includes('--apply') || isApplyFlag('MIGRATION_APPLY');
}

type Repair = {
  documentId: string;
  versionId: string;
  key: string;
  antes: string;
  depois: string;
};

/**
 * Só repara o que tem a assinatura exata do bug, e só na direção de restaurar texto perdido.
 *
 * As condições são deliberadamente estreitas. O reparo roda sobre dado de produção sem nada com
 * que conferir depois, então uma regra frouxa que acerte a maioria e estrague uma minoria é pior
 * que não rodar: o estrago novo seria indistinguível do antigo.
 *
 * 1. O armazenado é sufixo do literal. O bug sempre removia um PREFIXO — nunca cortou o fim, nunca
 *    trocou caractere. Valor que não é sufixo foi produzido por outra coisa.
 * 2. Recomputar com a função corrigida devolve algo diferente do armazenado. Se devolve igual, o
 *    valor nunca foi vítima: "Fatura nº FAT-2026" continua virando "FAT-2026", e está certo.
 * 3. O recomputado é mais longo. Garante que o reparo só devolve texto, nunca corta mais.
 */
export function planRepair(
  key: string,
  field: MongoVersionMetadataField,
): { antes: string; depois: string } | null {
  const value = field.value;
  const stored = field.normalizedValue;
  if (typeof value !== 'string' || typeof stored !== 'string') return null;

  const literal = value.trim();
  if (!literal || literal === stored) return null;
  if (!literal.endsWith(stored)) return null;

  const recomputed = normalizeStringFieldValue(literal, {
    key,
    label: field.label,
    type: 'string',
    required: false,
  });

  if (typeof recomputed !== 'string') return null;
  if (recomputed === stored) return null;
  if (recomputed.length <= stored.length) return null;

  return { antes: stored, depois: recomputed };
}

async function repairVersions(
  db: Db,
  versionsName: string,
  apply: boolean,
): Promise<{ scanned: number; documentsTouched: number; repairs: Repair[] }> {
  const versions = db.collection<MongoDocumentVersion>(versionsName);
  const cursor = versions.find({ metadata: { $exists: true, $ne: {} } });

  let scanned = 0;
  let documentsTouched = 0;
  const repairs: Repair[] = [];

  for await (const version of cursor) {
    scanned += 1;
    const metadata = version.metadata ?? {};
    const updates: Record<string, string> = {};

    for (const [key, field] of Object.entries(metadata)) {
      const plan = planRepair(key, field);
      if (!plan) continue;

      updates[`metadata.${key}.normalizedValue`] = plan.depois;
      repairs.push({
        documentId: version.documentId,
        versionId: version._id,
        key,
        antes: plan.antes,
        depois: plan.depois,
      });
    }

    if (Object.keys(updates).length === 0) continue;
    documentsTouched += 1;

    if (apply) {
      await versions.updateOne({ _id: version._id }, { $set: updates });
    }
  }

  return { scanned, documentsTouched, repairs };
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const apply = hasApplyArg();
  const db = await getDb();
  const database = getMongoDatabaseName();
  const report = createReportWriter();

  report.section('Reparo de normalizedValue decapitado');
  report.line(`Database: ${database}`);
  report.line(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  const shared = resolveSharedCollections();
  const exists = await db.listCollections({ name: shared.documentVersions }).hasNext();
  if (!exists) {
    report.line(`Coleção ${shared.documentVersions} não existe. Nada a fazer.`);
    report.write(REPORT_PATH);
    await closeMongoConnection();
    return;
  }

  const { scanned, documentsTouched, repairs } = await repairVersions(
    db,
    shared.documentVersions,
    apply,
  );

  report.section('RESULTADO');
  report.line(`Versões varridas: ${scanned}`);
  report.line(`Versões com campo a reparar: ${documentsTouched}`);
  report.line(`Campos reparados: ${repairs.length}`);

  if (repairs.length > 0) {
    report.section('CAMPOS');
    for (const repair of repairs.slice(0, 200)) {
      report.line(
        `${repair.documentId} · ${repair.key}: "${repair.antes}" -> "${repair.depois}"`,
      );
    }
    if (repairs.length > 200) {
      report.line(`… e mais ${repairs.length - 200} campos.`);
    }
  }

  if (!apply) {
    report.line('');
    report.line('Execute com --apply para gravar.');
  } else if (repairs.length > 0) {
    report.line('');
    report.line(
      'Agora rode `npm run db:backfill-search-meta -- --apply`: searchMeta e metadataIndex são projeções destes metadados e carregam o mesmo estrago.',
    );
  }

  report.write(REPORT_PATH);
  console.log(`Relatório: ${REPORT_PATH}`);
  console.log(
    `Database: ${database} | versões=${scanned} afetadas=${documentsTouched} campos=${repairs.length} (${apply ? 'APPLY' : 'DRY-RUN'})`,
  );

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongoConnection().catch(() => undefined);
  process.exit(1);
});
