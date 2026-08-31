/**
 * Remove solicitações de assinatura que ficaram gravadas sem nunca chegar a quem pediu.
 *
 * `createDocumentSignatureRequest` grava a solicitação e marca o documento como pendente
 * **antes** de montar o link do portal. Enquanto o endereço público do app faltou em produção,
 * essa montagem lançava e a resposta virava 500 — cada tentativa deixava para trás uma
 * solicitação pendente cujo token ninguém jamais viu.
 *
 * Não há marca no registro que separe a órfã da sadia: as duas têm hash de token e estão
 * `pending`; o que falhou foi só a resposta. Por isso o script **lista** e só apaga o que for
 * nomeado em `--request`. Nada de heurística apagando solicitação de verdade.
 *
 * Listar as pendentes de um documento:
 *   npx tsx scripts/cleanup-orphan-signature-requests.ts --tenant=<tenantId> --document=<documentId>
 *
 * Apagar as escolhidas:
 *   npx tsx scripts/cleanup-orphan-signature-requests.ts --tenant=<tenantId> --request=<id>,<id> --apply
 */
import 'dotenv/config';
import { SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { closeMongoConnection, getDb, isMongoNativeConfigured } from '../server/db/mongoClient.js';
import type { MongoDocumentSignatureRequest } from '../server/db/types.js';
import { syncDocumentSignatureStatus } from '../server/services/signatures/documentSignatureService.js';

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length).trim() || undefined;
}

function readIdList(name: string): string[] {
  return (readFlag(name) ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function main() {
  if (!isMongoNativeConfigured()) {
    console.error('MONGODB_URI não configurada.');
    process.exit(1);
  }

  const tenantId = readFlag('tenant');
  if (!tenantId) {
    console.error('Informe --tenant=<tenantId>.');
    process.exit(1);
  }

  const documentId = readFlag('document');
  const requestIds = readIdList('request');
  const apply = process.argv.includes('--apply');

  if (apply && requestIds.length === 0) {
    console.error('--apply exige --request=<id>[,<id>]: o script não escolhe sozinho o que apagar.');
    process.exit(1);
  }

  const db = await getDb();
  const collection = db.collection<MongoDocumentSignatureRequest>(
    SHARED_APP_COLLECTIONS.documentSignatureRequests,
  );

  if (!apply) {
    const pending = await collection
      .find({
        tenantId,
        status: 'pending',
        ...(documentId ? { documentId } : {}),
      })
      .sort({ createdAt: -1 })
      .toArray();

    if (pending.length === 0) {
      console.log('Nenhuma solicitação pendente.');
      await closeMongoConnection();
      return;
    }

    console.log(`${pending.length} solicitação(ões) pendente(s):`);
    for (const request of pending) {
      const signer = request.signers[0];
      console.log(
        `  ${request.signatureRequestId}  doc=${request.documentId}  criada=${request.createdAt.toISOString()}  signatário=${signer?.email ?? '—'} (${signer?.signerType ?? '—'})`,
      );
    }
    console.log(
      '\nModo seco. Confira quais nunca entregaram link e rode de novo com --request=<id>,<id> --apply.',
    );
    await closeMongoConnection();
    return;
  }

  const targets = await collection.find({ tenantId, signatureRequestId: { $in: requestIds } }).toArray();

  const missing = requestIds.filter(
    (id) => !targets.some((target) => target.signatureRequestId === id),
  );
  if (missing.length > 0) {
    console.error(`Não encontradas neste tenant: ${missing.join(', ')}`);
    process.exit(1);
  }

  const signed = targets.filter((target) => target.status !== 'pending');
  if (signed.length > 0) {
    console.error(
      `Recusado: ${signed.map((target) => `${target.signatureRequestId} (${target.status})`).join(', ')} não está pendente.`,
    );
    process.exit(1);
  }

  const result = await collection.deleteMany({
    tenantId,
    signatureRequestId: { $in: requestIds },
  });
  console.log(`${result.deletedCount} removida(s).`);

  for (const touched of [...new Set(targets.map((target) => target.documentId))]) {
    await syncDocumentSignatureStatus(tenantId, touched);
    console.log(`  signatureStatus recalculado: ${touched}`);
  }

  await closeMongoConnection();
}

main().catch(async (error) => {
  console.error(error);
  await closeMongoConnection();
  process.exit(1);
});
