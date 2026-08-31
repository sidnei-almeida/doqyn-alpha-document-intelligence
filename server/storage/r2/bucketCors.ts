import { createHash } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger.js';
import { ServiceError } from '../../utils/serviceErrors.js';

/**
 * Política de CORS dos buckets R2.
 *
 * O arquivo não passa pela API: o cliente recebe uma URL assinada e faz `PUT` direto no R2. Sem
 * política de CORS o navegador nem chega a tentar — barra no preflight, e o upload falha com
 * `ERR_FAILED` sem nada nos logs do servidor, porque requisição nenhuma chegou.
 *
 * Por isso a política é reconciliada e *conferida* em vez de escrita e esquecida: aplicar sem ler
 * de volta deixa o bucket passar por pronto quando não está.
 */

const REQUIRED_METHODS = ['PUT', 'GET', 'HEAD'] as const;

/** O cliente lê o `ETag` para confirmar que o corpo chegou inteiro; sem `expose` fica escondido. */
const REQUIRED_EXPOSE_HEADERS = ['ETag'] as const;

const MAX_AGE_SECONDS = 3600;

const DEV_ORIGINS = ['http://localhost:5173'];

/** Forma lida do R2: tudo opcional, porque a política pode vir parcial ou ausente. */
type CorsRule = {
  AllowedOrigins?: string[];
  AllowedMethods?: string[];
  AllowedHeaders?: string[];
  ExposeHeaders?: string[];
  MaxAgeSeconds?: number;
};

/** Forma escrita: `AllowedOrigins`/`AllowedMethods` obrigatórios, como o SDK exige. */
type WritableCorsRule = CorsRule & {
  AllowedOrigins: string[];
  AllowedMethods: string[];
};

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(normalizeOrigin).filter(Boolean);
}

function allowsLocalhost(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * União de `ALLOWED_ORIGINS` (lista), `DOQYN_PUBLIC_APP_URL` e `PUBLIC_APP_URL`.
 *
 * Fonte única para o código e para `scripts/r2-set-cors.mjs`: antes o script lia a lista e o
 * código lia uma variável só, então apex e `www` divergiam e uma das duas quebrava.
 *
 * `localhost` só fora de produção — liberar a origem de desenvolvimento no bucket de produção
 * deixaria qualquer página local emitir `PUT` com uma URL assinada que vazasse.
 */
export function resolveCorsOrigins(): string[] {
  const origins = new Set<string>();

  for (const origin of splitList(process.env.ALLOWED_ORIGINS)) {
    origins.add(origin);
  }
  for (const key of ['DOQYN_PUBLIC_APP_URL', 'PUBLIC_APP_URL'] as const) {
    const value = normalizeOrigin(process.env[key] ?? '');
    if (value) origins.add(value);
  }

  if (allowsLocalhost()) {
    for (const origin of DEV_ORIGINS) origins.add(origin);
  }

  return [...origins];
}

export function buildCorsRules(origins: string[]): WritableCorsRule[] {
  return [
    {
      AllowedOrigins: [...origins],
      AllowedMethods: [...REQUIRED_METHODS],
      AllowedHeaders: ['*'],
      ExposeHeaders: [...REQUIRED_EXPOSE_HEADERS],
      MaxAgeSeconds: MAX_AGE_SECONDS,
    },
  ];
}

export function corsPolicyHash(origins: string[]): string {
  const payload = JSON.stringify({
    origins: [...origins].sort(),
    methods: [...REQUIRED_METHODS].sort(),
    expose: [...REQUIRED_EXPOSE_HEADERS].sort(),
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * Cobertura, não igualdade: uma política mais ampla configurada à mão no painel continua válida.
 * Exigir igualdade faria o código reescrever (e possivelmente estreitar) o que um humano ajustou.
 */
export function bucketCorsSatisfies(rules: CorsRule[] | undefined, origins: string[]): boolean {
  if (!rules?.length || origins.length === 0) return false;

  return origins.every((origin) =>
    rules.some((rule) => {
      const allowedOrigins = rule.AllowedOrigins ?? [];
      const coversOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
      if (!coversOrigin) return false;

      const methods = (rule.AllowedMethods ?? []).map((method) => method.toUpperCase());
      if (!REQUIRED_METHODS.every((method) => methods.includes(method))) return false;

      const expose = (rule.ExposeHeaders ?? []).map((header) => header.toLowerCase());
      return REQUIRED_EXPOSE_HEADERS.every((header) => expose.includes(header.toLowerCase()));
    }),
  );
}

/**
 * Cache por processo: `bucket -> hash da política confirmada`. Sem ele cada URL pré-assinada
 * pagaria duas idas ao R2, e o presign está no caminho quente do upload.
 */
const verifiedBuckets = new Map<string, string>();

export function resetBucketCorsCache(): void {
  verifiedBuckets.clear();
}

async function getBucketCorsRules(
  client: S3Client,
  bucket: string,
): Promise<CorsRule[] | undefined> {
  const { GetBucketCorsCommand } = await import('@aws-sdk/client-s3');
  try {
    const result = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return result.CORSRules as CorsRule[] | undefined;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    // Bucket sem política responde com erro, e isso é uma resposta legítima: não tem CORS.
    if (
      name === 'NoSuchCORSConfiguration' ||
      name === 'NoSuchCorsConfiguration' ||
      status === 404
    ) {
      return undefined;
    }
    throw error;
  }
}

export type EnsureBucketCorsResult = {
  bucket: string;
  applied: boolean;
  policyHash: string;
  origins: string[];
};

export type EnsureBucketCorsOptions = {
  /** Ignora o cache do processo — usado por scripts de reconciliação e pelos testes. */
  force?: boolean;
};

/**
 * Garante que o bucket aceita `PUT` do navegador a partir das origens do app.
 *
 * Lê antes de escrever de propósito: se o token admin não tiver permissão de `PutBucketCors` mas
 * o bucket já estiver correto (configurado à mão, ou por `scripts/r2-set-cors.mjs`), o upload
 * continua funcionando em vez de quebrar por uma escrita desnecessária.
 */
export async function ensureBucketCors(
  client: S3Client,
  bucket: string,
  options: EnsureBucketCorsOptions = {},
): Promise<EnsureBucketCorsResult> {
  const origins = resolveCorsOrigins();
  if (origins.length === 0) {
    throw new ServiceError(
      'Nenhuma origem pública configurada para o CORS do R2 (ALLOWED_ORIGINS / DOQYN_PUBLIC_APP_URL).',
      'R2_CORS_ORIGINS_MISSING',
      500,
    );
  }

  const policyHash = corsPolicyHash(origins);

  if (!options.force && verifiedBuckets.get(bucket) === policyHash) {
    return { bucket, applied: false, policyHash, origins };
  }

  let current: CorsRule[] | undefined;
  try {
    current = await getBucketCorsRules(client, bucket);
  } catch (error) {
    throw new ServiceError(
      `Não foi possível ler o CORS do bucket ${bucket}: ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }`,
      'R2_CORS_NOT_CONFIGURED',
      503,
    );
  }

  if (bucketCorsSatisfies(current, origins)) {
    verifiedBuckets.set(bucket, policyHash);
    return { bucket, applied: false, policyHash, origins };
  }

  const { PutBucketCorsCommand } = await import('@aws-sdk/client-s3');
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: { CORSRules: buildCorsRules(origins) },
      }),
    );
  } catch (error) {
    throw new ServiceError(
      `Falha ao aplicar CORS no bucket ${bucket}: ${
        error instanceof Error ? error.message : 'erro desconhecido'
      }`,
      'R2_CORS_NOT_CONFIGURED',
      503,
    );
  }

  // Conferir depois de aplicar é o ponto todo: sem esta leitura o bucket volta a passar por
  // pronto sem estar, e o upload falha no navegador sem deixar rastro no servidor.
  const applied = await getBucketCorsRules(client, bucket).catch(() => undefined);
  if (!bucketCorsSatisfies(applied, origins)) {
    throw new ServiceError(
      `CORS do bucket ${bucket} não confere após aplicar — upload pelo navegador ficaria bloqueado.`,
      'R2_CORS_NOT_CONFIGURED',
      503,
    );
  }

  verifiedBuckets.set(bucket, policyHash);
  logger.info('r2 bucket cors applied', { bucket, origins, policyHash });

  return { bucket, applied: true, policyHash, origins };
}
