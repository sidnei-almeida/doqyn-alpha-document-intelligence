import type { S3Client } from '@aws-sdk/client-s3';
import { createTenantBucket, headTenantBucket } from '../r2/r2BucketProvisioner.js';
import { ensureBucketCors } from '../r2/bucketCors.js';
import { logger } from '../../utils/logger.js';

/**
 * O espelho provisiona bucket com as mesmas regras do R2.
 *
 * Quando um tenant PJ nasce, o R2 ganha um bucket próprio já configurado — criado e com a política
 * de CORS aplicada. O espelho tem de repetir isso, senão ele não é espelho: seria uma pilha de
 * objetos sem a fronteira e sem a configuração que o original tem. Tenant PF continua no bucket
 * compartilhado, sob o prefixo opaco, exatamente como do outro lado.
 *
 * As funções de criação e de CORS são as mesmas do R2 (`headTenantBucket`, `createTenantBucket`,
 * `ensureBucketCors`) — elas recebem um `S3Client` qualquer, então reaproveitá-las garante que as
 * duas pontas não possam divergir com o tempo. Duplicar a regra aqui seria criar dois lugares para
 * a política de CORS mudar, e um deles ficaria para trás.
 */

/**
 * Buckets já garantidos neste processo.
 *
 * Memo próprio, e não o cache interno de `ensureBucketCors`: aquele é indexado só pelo nome do
 * bucket, e o nome no espelho é **o mesmo** do R2 de propósito. Sem este Set, verificar o bucket do
 * R2 marcaria o do espelho como pronto, e o espelho passaria a vida sem CORS e talvez sem existir.
 */
const ensuredMirrorBuckets = new Set<string>();

/** Só para o teste: esquece o que já foi garantido. */
export function resetMirrorBucketCacheForTests(): void {
  ensuredMirrorBuckets.clear();
}

export type EnsureMirrorBucketResult = {
  bucket: string;
  created: boolean;
  corsApplied: boolean;
};

/**
 * Garante que o bucket existe no espelho e está configurado como o do R2.
 *
 * Roda uma vez por bucket por processo. Criar bucket é idempotente do lado de lá
 * (`BucketAlreadyOwnedByYou` é engolido), então uma corrida entre dois workers não é problema.
 *
 * Falha de CORS não impede a cópia: o CORS só importa quando o navegador fala direto com o
 * storage, e hoje o fallback de leitura passa pelo servidor. Recusar o espelho inteiro porque a
 * política não pôde ser escrita trocaria uma cópia que serve por cópia nenhuma.
 */
export async function ensureMirrorBucket(
  client: S3Client,
  bucket: string,
): Promise<EnsureMirrorBucketResult> {
  if (ensuredMirrorBuckets.has(bucket)) {
    return { bucket, created: false, corsApplied: false };
  }

  const exists = await headTenantBucket(client, bucket);
  if (!exists) {
    await createTenantBucket(client, bucket);
  }

  let corsApplied = false;
  try {
    // `force` porque o cache de `ensureBucketCors` é por nome de bucket, e o nome aqui é o mesmo
    // do R2: sem isso, a verificação do original responderia pelo espelho.
    const cors = await ensureBucketCors(client, bucket, { force: true });
    corsApplied = cors.applied;
  } catch (error) {
    logger.warn('CORS do bucket espelho não aplicado', {
      bucket,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  ensuredMirrorBuckets.add(bucket);

  logger.info('bucket do espelho pronto', {
    bucket,
    status: exists ? 'exists' : 'created',
    corsApplied,
  });

  return { bucket, created: !exists, corsApplied };
}
