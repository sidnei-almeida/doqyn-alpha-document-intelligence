import 'dotenv/config';
import { deactivateExpiredTrashDocuments } from '../server/services/trash/documentTrashService.js';

function hasApplyFlag(): boolean {
  return process.argv.includes('--apply');
}

async function main() {
  const apply = hasApplyFlag();
  const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
  const tenantId = tenantArg?.split('=')[1]?.trim();

  console.log(
    apply
      ? 'Desativando documentos com lixeira expirada (sem excluir storage)…'
      : 'Dry-run: documentos elegíveis para desativação (lixeira expirada)…',
  );

  const result = await deactivateExpiredTrashDocuments({ tenantId, apply });

  console.log(`Elegíveis: ${result.eligible.length}`);
  if (result.eligible.length > 0) {
    for (const row of result.eligible.slice(0, 50)) {
      console.log(`  - ${row.tenantId}/${row.documentId} (expira ${row.trashExpiresAt})`);
    }
    if (result.eligible.length > 50) {
      console.log(`  … e mais ${result.eligible.length - 50}`);
    }
  }

  if (apply) {
    console.log(
      `Desativação concluída: ${result.deactivated} ok, ${result.failed} falha(s).`,
    );
  } else {
    console.log(
      'Nenhuma alteração aplicada. Use --apply para desativar documentos expirados na lixeira.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
