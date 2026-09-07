import { resetBucketCorsCache } from '../../server/storage/r2/bucketCors.js';

/**
 * Todo caminho de provisionamento de bucket passa por `ensureBucketCors`, então qualquer mock de
 * `S3Client` que só saiba responder `HeadBucket`/`CreateBucket` quebra. Este helper responde
 * `GetBucketCors`/`PutBucketCors` guardando a política em memória, e deixa o resto seguir para o
 * handler do teste.
 */

export const TEST_CORS_ORIGIN = 'https://app.doqyn.test';

/** Origem única e `NODE_ENV` fora de produção não se misturam: fixamos a origem explicitamente. */
export function setCorsEnv(): void {
  process.env.DOQYN_PUBLIC_APP_URL = TEST_CORS_ORIGIN;
  resetBucketCorsCache();
}

export function withBucketCorsStub(
  handler: (command: unknown) => Promise<unknown>,
): (command: unknown) => Promise<unknown> {
  const stored = new Map<string, unknown[]>();

  return async (command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor.name;
    const input = (command as { input?: Record<string, unknown> }).input ?? {};
    const bucket = String(input.Bucket ?? '');

    if (name === 'GetBucketCorsCommand') {
      const rules = stored.get(bucket);
      if (!rules) {
        const error = new Error('no cors') as Error & { name: string };
        error.name = 'NoSuchCORSConfiguration';
        throw error;
      }
      return { CORSRules: rules };
    }

    if (name === 'PutBucketCorsCommand') {
      const config = input.CORSConfiguration as { CORSRules: unknown[] } | undefined;
      stored.set(bucket, config?.CORSRules ?? []);
      return {};
    }

    return handler(command);
  };
}

export { resetBucketCorsCache };
