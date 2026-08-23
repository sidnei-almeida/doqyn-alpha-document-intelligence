/**
 * Backfill de governança: garante que toda categoria ativa tenha regra de extração, e que todo
 * tenant tenha a pasta "Sem categoria".
 *
 * Existe porque categoria sem regra era uma pasta que não aceitava documento — a confirmação exige
 * classe E regra, e o classificador só recebe classes que têm regra. Tenants provisionados antes da
 * regra padrão carregam esse defeito, e um deles é qualquer tenant criado até 23/08/2026.
 *
 * Idempotente: rodar duas vezes não cria nada duas vezes.
 *
 *   npx tsx scripts/backfill-category-rules.ts            # relatório, não escreve
 *   npx tsx scripts/backfill-category-rules.ts --apply    # aplica
 */
import 'dotenv/config';
import { getDb, closeMongoConnection } from '../server/db/mongoClient.js';
import { REGISTRY_COLLECTIONS } from '../server/db/constants.js';
import { ensureDefaultExtractionRule } from '../server/services/documentDefaultExtractionRule.js';
import { ensureUncategorizedCategory } from '../server/services/documentCategoriesService.js';

const APPLY = process.argv.includes('--apply');

type TenantRow = { tenantId: string; displayName?: string };

async function main(): Promise<void> {
  const db = await getDb();
  const tenants = (await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .find({ status: 'active' })
    .toArray()) as unknown as TenantRow[];

  if (!tenants.length) {
    console.log('Nenhum tenant ativo encontrado.');
    return;
  }

  console.log(`${tenants.length} tenant(s) ativo(s). Modo: ${APPLY ? 'APLICAR' : 'relatório'}\n`);

  for (const tenant of tenants) {
    const owner = await resolveOwnerUserId(tenant.tenantId);
    console.log(`— ${tenant.tenantId}${tenant.displayName ? ` (${tenant.displayName})` : ''}`);

    if (!owner) {
      console.log('  sem dono identificável em tenant_members; pulando.');
      continue;
    }

    if (!APPLY) {
      console.log('  (relatório) garantiria regra padrão das categorias e a pasta Sem categoria.');
      continue;
    }

    const uncategorizedId = await ensureUncategorizedCategory(tenant.tenantId, owner);
    console.log(`  pasta Sem categoria: ${uncategorizedId}`);

    const categories = await listActiveCategoryIds(tenant.tenantId, owner);
    let created = 0;
    for (const categoryId of categories) {
      const rule = await ensureDefaultExtractionRule(tenant.tenantId, categoryId, owner);
      if (rule) {
        created += 1;
        console.log(`  regra criada para ${categoryId}`);
      }
    }
    console.log(`  ${categories.length} categoria(s), ${created} regra(s) criada(s).`);
  }
}

/** O dono define o escopo das coleções compartilhadas dos tenants PF. */
async function resolveOwnerUserId(tenantId: string): Promise<string | null> {
  const db = await getDb();
  const member = await db
    .collection('tenant_members')
    .findOne({ tenantId } as Record<string, unknown>);

  // `authUserId` é o id no doqyn-auth-service, que é o que o escopo das coleções compartilhadas usa.
  const userId = (member as { authUserId?: string; memberId?: string } | null)?.authUserId;
  return typeof userId === 'string' && userId ? userId : null;
}

async function listActiveCategoryIds(tenantId: string, ownerUserId: string): Promise<string[]> {
  const { requireTenantGovernanceCollections } =
    await import('../server/tenancy/requireTenantDocumentCollections.js');
  const { buildClassRuleOwnershipFilter } = await import('../server/tenancy/documentOwnership.js');

  const collections = await requireTenantGovernanceCollections(tenantId, { userId: ownerUserId });
  const scope = buildClassRuleOwnershipFilter(collections.storage);
  const rows = await collections.documentCategories
    .find({ ...scope, active: true } as Record<string, unknown>)
    .toArray();

  return (rows as Array<{ _id: string }>).map((row) => row._id);
}

main()
  .catch((error) => {
    console.error('Falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeMongoConnection());
