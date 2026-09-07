/**
 * Desativa regras de extração duplicadas: uma classe, uma regra ativa.
 *
 * Criar categoria pela interface gravava DUAS regras v1 até 07/09/2026 — o handler da API chamava
 * `createDefaultExtractionRuleForCategory` além do que `createDocumentCategory` já garantia por
 * dentro. Seis das sete classes em produção ficaram assim, com 25 ms de diferença entre as duas.
 *
 * O efeito não era erro visível, era loteria: `getMongoClassAndRule` resolvia pela ordem natural do
 * Mongo, e "quais campos este documento tem" passava a depender de em que ordem o banco devolveu os
 * documentos. A causa foi removida no mesmo commit; isto limpa o que já está gravado.
 *
 * Qual fica: a regra padrão da categoria (`ext_${categoryId}_v1`), que é a que o pipeline vinha
 * usando e a que carrega a âncora de data. Sem ela entre as candidatas, fica a mais recente.
 * As outras viram `active: false` — nada é apagado, e nenhum metadado já extraído muda.
 *
 *   npx tsx scripts/dedupe-active-extraction-rules.ts            # relatório, não escreve
 *   npx tsx scripts/dedupe-active-extraction-rules.ts --apply    # aplica
 */
import 'dotenv/config';
import { getDb, closeMongoConnection } from '../server/db/mongoClient.js';

const APPLY = process.argv.includes('--apply');

type RuleRow = {
  _id: string;
  tenantId?: string;
  categoryId?: string;
  classId?: string;
  version?: number;
  active?: boolean;
  updatedAt?: Date;
  createdAt?: Date;
  fields?: Array<{ key: string }>;
};

const timeOf = (rule: RuleRow) => (rule.updatedAt ?? rule.createdAt)?.getTime() ?? 0;

/** A que fica: a regra padrão da categoria; na falta dela, a mais recente. */
function pickKeeper(rules: RuleRow[]): RuleRow {
  const categoryId = rules[0].categoryId ?? rules[0].classId;
  const canonical = rules.find((rule) => rule._id === `ext_${categoryId}_v1`);
  if (canonical) return canonical;
  return [...rules].sort(
    (a, b) => (b.version ?? 0) - (a.version ?? 0) || timeOf(b) - timeOf(a),
  )[0];
}

async function main(): Promise<void> {
  const db = await getDb();
  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => name.startsWith('document_extraction_rules'));

  console.log(
    `${collections.length} coleção(ões) de regras. Modo: ${APPLY ? 'APLICAR' : 'relatório'}\n`,
  );

  let duplicated = 0;
  let deactivated = 0;

  for (const name of collections) {
    const rules = (await db
      .collection(name)
      .find({ active: true })
      .toArray()) as unknown as RuleRow[];

    const groups = new Map<string, RuleRow[]>();
    for (const rule of rules) {
      const key = `${rule.tenantId ?? '?'}::${rule.categoryId ?? rule.classId ?? '?'}`;
      groups.set(key, [...(groups.get(key) ?? []), rule]);
    }

    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      duplicated += 1;

      const keeper = pickKeeper(group);
      console.log(`${key} — ${group.length} ativas`);
      console.log(`  fica:  ${keeper._id} (${(keeper.fields ?? []).map((f) => f.key).join(',')})`);

      for (const rule of group) {
        if (rule._id === keeper._id) continue;
        console.log(
          `  ${APPLY ? 'desativa' : 'desativaria'}: ${rule._id} (${(rule.fields ?? [])
            .map((f) => f.key)
            .join(',')})`,
        );
        if (!APPLY) continue;

        await db.collection(name).updateOne(
          { _id: rule._id } as Record<string, unknown>,
          {
            $set: {
              active: false,
              updatedAt: new Date(),
              deactivatedReason: 'duplicate_active_rule',
            },
          },
        );
        deactivated += 1;
      }
    }
  }

  console.log(
    `\n${duplicated} classe(s) com mais de uma regra ativa; ${APPLY ? `${deactivated} desativada(s)` : 'nada gravado'}.`,
  );
  if (!APPLY && duplicated > 0) console.log('Rode com --apply para gravar.');
}

main()
  .catch((error) => {
    console.error('Falhou:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoConnection();
  });
