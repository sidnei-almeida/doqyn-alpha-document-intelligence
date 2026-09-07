/**
 * Backfill: dá a toda regra de extração um campo onde a data de vencimento possa pousar.
 *
 * Existe porque a regra padrão nasceu sem campo de validade, e o defeito era invisível: a tela do
 * documento injeta uma linha "Data de vencimento" mesmo quando a classe não declara campo nenhum,
 * então o campo aparecia como FALTANDO e parecia falha de leitura da IA. Não era — a extração
 * calculava a data a partir da âncora e do prazo e não tinha onde escrevê-la. O alerta de
 * vencimento nunca disparava para essas classes.
 *
 * Só toca regra que não tem NENHUM campo de data final (o vocabulário é o mesmo de
 * `derivedDates.isEndDateFieldName`). Quem já configurou `data_validade`, `vigencia_fim` ou
 * equivalente fica como está — a regra do tenant vence a nossa.
 *
 * Idempotente: rodar duas vezes não acrescenta o campo duas vezes.
 *
 *   npx tsx scripts/backfill-validity-field.ts            # relatório, não escreve
 *   npx tsx scripts/backfill-validity-field.ts --apply    # aplica
 */
import 'dotenv/config';
import { getDb, closeMongoConnection } from '../server/db/mongoClient.js';
import { isEndDateFieldName } from '../server/ai/utils/derivedDates.js';
import { DEFAULT_EXTRACTION_RULE_FIELDS } from '../server/services/documentDefaultExtractionRule.js';
import type { MongoRuleField } from '../server/db/types.js';
import { CANONICAL_VALIDITY_KEY } from '../shared/metadataKeyNormalize.js';

const APPLY = process.argv.includes('--apply');

const VALIDITY_FIELD = DEFAULT_EXTRACTION_RULE_FIELDS.find(
  (field) => field.key === CANONICAL_VALIDITY_KEY,
);

/**
 * A primeira versão deste script gravou `data_vencimento`, e essa chave não sobrevive à
 * canonicalização: ao confirmar a versão ela vira `data_validade`, e a linha da regra ficava
 * eternamente vazia enquanto o mesmo dado aparecia abaixo como campo fora da regra. Renomear é
 * parte do backfill, não uma migração à parte — quem rodou a versão anterior precisa disto.
 */
const LEGACY_VALIDITY_KEY = 'data_vencimento';

function legacyValidityField(fields: MongoRuleField[] | undefined): MongoRuleField | undefined {
  return (fields ?? []).find((field) => field.key === LEGACY_VALIDITY_KEY);
}

function hasValidityField(fields: MongoRuleField[] | undefined): boolean {
  return (fields ?? []).some(
    (field) =>
      field.type === 'date' &&
      isEndDateFieldName(field),
  );
}

async function main(): Promise<void> {
  if (!VALIDITY_FIELD) throw new Error('Campo de vencimento ausente da regra padrão.');

  const db = await getDb();
  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => name.startsWith('document_extraction_rules'));

  console.log(
    `${collections.length} coleção(ões) de regras. Modo: ${APPLY ? 'APLICAR' : 'relatório'}\n`,
  );

  let scanned = 0;
  let touched = 0;

  for (const name of collections) {
    const rules = await db.collection(name).find({}).toArray();
    for (const rule of rules) {
      scanned += 1;
      const fields = rule.fields as MongoRuleField[] | undefined;

      const legacy = legacyValidityField(fields);
      if (legacy) {
        touched += 1;
        const target = `${name} :: ${rule._id}`;
        console.log(
          `  ${APPLY ? 'renomeia' : 'renomearia'} ${LEGACY_VALIDITY_KEY} → ${CANONICAL_VALIDITY_KEY} em ${target}`,
        );
        if (APPLY) {
          const next = (fields ?? []).map((field) =>
            field.key === LEGACY_VALIDITY_KEY ? { ...VALIDITY_FIELD } : field,
          );
          await db
            .collection(name)
            .updateOne({ _id: rule._id }, { $set: { fields: next, updatedAt: new Date() } });
        }
        continue;
      }

      if (hasValidityField(fields)) continue;

      touched += 1;
      const label = `${name} :: ${rule._id} (classe ${rule.classId ?? rule.categoryId ?? '?'})`;
      if (!APPLY) {
        console.log(`  (relatório) acrescentaria ${CANONICAL_VALIDITY_KEY} em ${label}`);
        continue;
      }

      // Depois da âncora e antes das partes: a ordem do array vira a ordem da ficha na tela.
      const anchorAt = (fields ?? []).findIndex((field) => field.type === 'date');
      const next = [...(fields ?? [])];
      next.splice(anchorAt >= 0 ? anchorAt + 1 : next.length, 0, VALIDITY_FIELD);

      await db
        .collection(name)
        .updateOne({ _id: rule._id }, { $set: { fields: next, updatedAt: new Date() } });
      console.log(`  acrescentado ${CANONICAL_VALIDITY_KEY} em ${label}`);
    }
  }

  console.log(`\n${scanned} regra(s) lida(s), ${touched} sem campo de validade.`);
  if (!APPLY && touched > 0) console.log('Rode com --apply para gravar.');
}

main()
  .catch((error) => {
    console.error('Falhou:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoConnection();
  });
