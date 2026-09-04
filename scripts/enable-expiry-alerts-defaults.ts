/**
 * Liga o alerta de vencimento nas regras de extração que ainda carregam o default antigo.
 *
 * O alerta nasceu opt-in: `normalizeExpiryAlertConfig` devolvia `enabled: false`, e a regra padrão
 * gravava esse valor em toda categoria criada. O resultado é que documentos com data de vencimento
 * nunca avisavam ninguém — e não havia erro em log, porque a varredura simplesmente não encontrava
 * categoria elegível.
 *
 * O default virou ligado, mas isso só alcança regra **sem** o campo: as que já existem têm
 * `enabled: false` gravado explicitamente e continuariam mudas. Este script é a virada delas.
 *
 * Conservador de propósito: só toca em regra que está no default antigo exato
 * (`enabled: false` e marcos `[30, 7, 1]` ou ausentes). Quem já configurou antecedência própria, ou
 * desligou o alerta depois de mexer nele, fica como está — desligar de propósito é uma decisão, e
 * uma migração não deve desfazê-la.
 *
 *   npx tsx scripts/enable-expiry-alerts-defaults.ts            # relatório, não escreve
 *   npx tsx scripts/enable-expiry-alerts-defaults.ts --apply    # aplica
 */
import 'dotenv/config';
import { getDb, closeMongoConnection } from '../server/db/mongoClient.js';
import {
  DEFAULT_EXPIRY_OFFSETS_DAYS,
  normalizeExpiryAlertConfig,
} from '../server/services/expiry/documentExpiryAlertService.js';

const APPLY = process.argv.includes('--apply');

/** Os marcos que a versão opt-in gravava. Regra com outro conjunto foi configurada à mão. */
const LEGACY_OFFSETS = [30, 7, 1];

type RuleRow = {
  _id: string;
  categoryId?: string;
  expiryAlerts?: {
    enabled?: boolean;
    offsetsDays?: number[];
    notifyGroupIds?: string[];
    notifyAfterExpiry?: boolean;
  };
};

/**
 * A regra ainda está no default antigo?
 *
 * Ausência de `expiryAlerts` conta: é regra anterior ao campo, e o que ela expressa é "ninguém
 * decidiu", não "alguém desligou".
 */
function isLegacyDefault(rule: RuleRow): boolean {
  const config = rule.expiryAlerts;
  if (!config) return true;
  if (config.enabled === true) return false;

  const offsets = config.offsetsDays;
  if (offsets === undefined) return true;
  if (!Array.isArray(offsets)) return false;

  const sorted = [...offsets].sort((a, b) => b - a);
  return sorted.length === LEGACY_OFFSETS.length && sorted.every((v, i) => v === LEGACY_OFFSETS[i]);
}

async function main(): Promise<void> {
  const db = await getDb();

  // As regras vivem em coleções prefixadas por tenant (`documentExtractionRules_<id>`) e, nos
  // tenants PF, numa coleção compartilhada. Varrer por prefixo alcança os dois sem precisar
  // resolver o escopo de cada tenant — a migração é de configuração, não de dado por dono.
  const collections = (await db.listCollections().toArray())
    .map((info) => info.name)
    .filter((name) => name.startsWith('documentExtractionRules'))
    .sort();

  if (collections.length === 0) {
    console.log('Nenhuma coleção de regras encontrada.');
    return;
  }

  console.log(
    `${collections.length} coleção(ões) de regras. Modo: ${APPLY ? 'APLICAR' : 'relatório'}`,
  );
  console.log(`Marcos novos: [${DEFAULT_EXPIRY_OFFSETS_DAYS.join(', ')}]\n`);

  let totalRules = 0;
  let totalLegacy = 0;
  let totalUpdated = 0;

  for (const name of collections) {
    const rules = (await db.collection(name).find({}).toArray()) as unknown as RuleRow[];
    const legacy = rules.filter(isLegacyDefault);
    totalRules += rules.length;
    totalLegacy += legacy.length;

    if (legacy.length === 0) {
      console.log(`— ${name}: ${rules.length} regra(s), nenhuma no default antigo.`);
      continue;
    }

    console.log(`— ${name}: ${legacy.length} de ${rules.length} regra(s) no default antigo.`);

    for (const rule of legacy) {
      const label = rule.categoryId ?? rule._id;
      if (!APPLY) {
        console.log(`  (relatório) ligaria ${label}`);
        continue;
      }

      // Passa pelo normalizador em vez de montar o objeto à mão: os grupos escolhidos são
      // preservados, e o formato fica idêntico ao que a aplicação grava.
      const next = normalizeExpiryAlertConfig({
        enabled: true,
        offsetsDays: DEFAULT_EXPIRY_OFFSETS_DAYS,
        notifyGroupIds: rule.expiryAlerts?.notifyGroupIds ?? [],
        notifyAfterExpiry: true,
      });

      await db
        .collection(name)
        .updateOne({ _id: rule._id } as Record<string, unknown>, { $set: { expiryAlerts: next } });
      totalUpdated += 1;
      console.log(`  ligado: ${label}`);
    }
  }

  console.log(
    `\n${totalRules} regra(s) no total, ${totalLegacy} no default antigo, ${totalUpdated} atualizada(s).`,
  );
  if (!APPLY && totalLegacy > 0) {
    console.log('Rode de novo com --apply para gravar.');
  }
}

main()
  .catch((error) => {
    console.error('Falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeMongoConnection());
