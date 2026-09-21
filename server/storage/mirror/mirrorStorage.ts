/**
 * Escrita e leitura no espelho.
 *
 * O upload do navegador vai direto para o R2 por URL assinada, então o servidor nunca vê os bytes
 * no caminho de envio — não existe "gravar nos dois ao mesmo tempo". A cópia é feita depois, a
 * partir do R2, pela fila de espelho, e é por isso que ela nunca atrasa nem derruba um upload.
 */
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  buildMirrorKey,
  getStorageMirrorConfig,
  type StorageMirrorConfig,
} from './mirrorConfig.js';
import { ensureMirrorBucket } from './mirrorBuckets.js';
import { logger } from '../../utils/logger.js';

let cachedClient: S3Client | null = null;
let cachedFor: string | null = null;

function getMirrorClient(config: StorageMirrorConfig): S3Client {
  // A identidade do cache não inclui o segredo de propósito: rotacionar a chave sem reiniciar o
  // processo é raro, e guardar o segredo numa string de cache seria pedir para vazá-lo em log.
  const identity = `${config.endpoint}|${config.region}|${config.forcePathStyle}`;
  if (cachedClient && cachedFor === identity) return cachedClient;

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Mesma forma do cliente do R2: sem limite, um socket travado prende o worker que o abriu.
    requestHandler: {
      connectionTimeout: 5_000,
      requestTimeout: config.requestTimeoutMs,
    },
  });
  cachedFor = identity;
  return cachedClient;
}

/** Só para o teste: derruba o cliente memorizado entre casos. */
export function resetMirrorClientForTests(): void {
  cachedClient = null;
  cachedFor = null;
}

export type MirrorWriteOutcome = 'mirrored' | 'already_present' | 'skipped_too_large' | 'disabled';

export type MirrorObjectInput = {
  /**
   * O bucket que o R2 resolveu para este tenant — não um bucket único do espelho.
   *
   * É o nome do bucket que carrega a fronteira de isolamento: PJ tem o seu, PF divide o
   * compartilhado sob prefixo opaco. Quem chama já o resolveu pelo `TenantStorageScope`, e repassá-lo
   * é o que mantém o espelho espelho.
   */
  bucket: string;
  objectKey: string;
  body: Buffer;
  contentType?: string;
  tenantId: string;
  versionId: string;
};

/**
 * Grava um objeto no espelho, se ele ainda não estiver lá.
 *
 * O `HEAD` antes do `PUT` não é zelo: a fila reentrega job, e reescrever um arquivo que já está
 * espelhado gasta banda e disco do espelho sem mudar nada. Objeto grande demais é recusado antes
 * de sair da máquina — o teto existe para o disco de quem hospeda o espelho não virar o teto do
 * produto.
 */
export async function mirrorObject(input: MirrorObjectInput): Promise<MirrorWriteOutcome> {
  const config = getStorageMirrorConfig();
  if (!config) return 'disabled';

  if (input.body.byteLength > config.maxObjectBytes) {
    logger.warn('objeto acima do teto do espelho — não espelhado', {
      tenantId: input.tenantId,
      versionId: input.versionId,
      sizeBytes: input.body.byteLength,
      maxObjectBytes: config.maxObjectBytes,
    });
    return 'skipped_too_large';
  }

  const client = getMirrorClient(config);
  const key = buildMirrorKey(config, input.objectKey);

  // Antes de escrever, o bucket do tenant tem de existir e estar configurado como o do R2.
  await ensureMirrorBucket(client, input.bucket);

  const present = await client
    .send(new HeadObjectCommand({ Bucket: input.bucket, Key: key }))
    .then(() => true)
    .catch(() => false);

  if (present) return 'already_present';

  await client.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );

  return 'mirrored';
}

/**
 * Lê do espelho. Devolve `null` quando ele está desligado ou não tem o objeto.
 *
 * **Quem chama já autorizou.** Esta função não conhece usuário nem sessão, e não pode virar o
 * caminho por onde um documento sai sem passar pela checagem de tenant — ela existe para ser
 * chamada de dentro do provedor de storage, depois que o serviço já decidiu que aquela pessoa pode
 * ler aquele documento.
 */
export async function readMirroredObject(
  bucket: string,
  objectKey: string,
): Promise<Buffer | null> {
  const config = getStorageMirrorConfig();
  if (!config) return null;

  try {
    const client = getMirrorClient(config);
    // Sem `ensureMirrorBucket` aqui de propósito: leitura não provisiona. Se o bucket não existe no
    // espelho, não há cópia, e criar um vazio só esconderia isso atrás de um "não encontrado".
    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: buildMirrorKey(config, objectKey),
      }),
    );

    const body = result.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) return null;

    return Buffer.from(await body.transformToByteArray());
  } catch (error) {
    logger.warn('leitura no espelho falhou', {
      bucket,
      objectKey,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}
