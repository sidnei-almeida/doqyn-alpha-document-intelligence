import 'dotenv/config';
import type { Server } from 'node:http';
import type {
  DoqynPublicMembership,
  DoqynVerifiedSession,
} from '../../server/auth/providers/doqynAuthProvider.js';
import type { PlatformRole } from '../../server/auth/types.js';
import { assertTestDatabase } from './assertTestDatabase.js';

/**
 * Bootstrap da API real dentro da suíte de teste (D-18).
 *
 * A sessão **não** é forjada no cache de sessão: `server/auth/sessionCache.ts` é Redis-only e
 * `getCachedDoqynSession` devolve `null` incondicionalmente sem cliente. O seam correto é
 * `SESSION_CACHE_ENABLED=false` mais um stub de `globalThis.fetch` na única chamada a
 * `/internal/sessions/verify` feita por `doqynAuthProvider.ts`.
 */

/** Nome do cookie de sessão usado pela suíte — fixado para não depender do `.env` da máquina. */
export const TEST_SESSION_COOKIE_NAME = 'doqyn_session';

const FORGED_SESSIONS = new Map<string, DoqynVerifiedSession>();

export function registerForgedSession(token: string, session: DoqynVerifiedSession): void {
  FORGED_SESSIONS.set(token, session);
}

export function clearForgedSessions(): void {
  FORGED_SESSIONS.clear();
}

export type ForgedSessionInput = {
  userId: string;
  email: string;
  tenantId: string;
  membershipId: string;
  roles: string[];
  tenantType?: 'business' | 'individual';
  tenantDisplayName?: string;
  accessGroupIds?: string[];
};

/**
 * Monta o payload no formato exato lido por `verifyDoqynAuthSession`.
 *
 * `activeMembership.status` precisa ser `'active'`: `hasActiveMembership` reprova qualquer outro
 * valor e o request morreria em 401 antes de chegar na camada de permissão — que é o que a suíte
 * quer medir.
 */
export function buildForgedSession(input: ForgedSessionInput): DoqynVerifiedSession {
  const membership: DoqynPublicMembership = {
    membershipId: input.membershipId,
    tenantId: input.tenantId,
    tenantType: input.tenantType ?? 'business',
    tenantDisplayName: input.tenantDisplayName ?? `Tenant de teste ${input.tenantId}`,
    status: 'active',
    roles: input.roles as PlatformRole[],
    accessGroupIds: input.accessGroupIds ?? [],
  };

  return {
    user: {
      id: input.userId,
      email: input.email,
      firstName: 'Teste',
      lastName: input.userId,
      status: 'active',
      emailVerified: true,
    },
    activeMembership: membership,
    memberships: [
      {
        membershipId: membership.membershipId,
        tenantId: membership.tenantId,
        tenantType: membership.tenantType,
        tenantDisplayName: membership.tenantDisplayName,
        status: membership.status,
      },
    ],
  };
}

/** Header `Cookie` para a sessão forjada de um token. */
export function sessionCookie(token: string): string {
  return `${TEST_SESSION_COOKIE_NAME}=${token}`;
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function installFetchStub(): () => void {
  const realFetch = globalThis.fetch;

  const stub: typeof globalThis.fetch = async (input, init) => {
    const url = resolveRequestUrl(input);

    if (url.endsWith('/internal/sessions/verify')) {
      const rawBody = typeof init?.body === 'string' ? init.body : '{}';
      const parsed = JSON.parse(rawBody) as { sessionToken?: string };
      const session = parsed.sessionToken ? FORGED_SESSIONS.get(parsed.sessionToken) : undefined;

      if (!session) {
        return Response.json({
          ok: false,
          code: 'INVALID_SESSION',
          message: 'Sessão inválida.',
        });
      }

      return Response.json({ ok: true, ...session });
    }

    return realFetch(input, init);
  };

  globalThis.fetch = stub;

  return () => {
    globalThis.fetch = realFetch;
  };
}

/**
 * Env do processo de teste. Definido **antes** de importar `server/apiServer.js`, porque `PORT` e
 * vários módulos de config são lidos no escopo do módulo.
 */
function applyTestEnv(): void {
  process.env.AUTH_PROVIDER = 'doqyn_auth';
  process.env.DOQYN_AUTH_COOKIE_NAME = TEST_SESSION_COOKIE_NAME;
  process.env.DOQYN_AUTH_INTERNAL_API_KEY = 'test-internal-api-key';
  // Base inalcançável de propósito: qualquer chamada ao auth-service que **não** seja a verificação
  // de sessão (ex.: sync de membros) falha rápido em vez de encostar num serviço real.
  process.env.DOQYN_AUTH_BASE_URL = 'http://127.0.0.1:59999';

  process.env.SESSION_CACHE_ENABLED = 'false';
  process.env.REDIS_ENABLED = 'false';
  delete process.env.REDIS_URL;

  process.env.STORAGE_PROVIDER = 'local';

  // `resolveTenantStorageScopeForTenant` exige config R2 presente para tenant business, mesmo sem
  // ler nenhum byte. Valores fictícios mantêm a suíte longe do bucket real.
  process.env.R2_ACCOUNT_ID = 'testaccount';
  process.env.R2_ENDPOINT = 'https://testaccount.r2.cloudflarestorage.com';
  process.env.R2_DEFAULT_BUCKET = 'doqyn-test-bucket';
}

export type TestApi = {
  baseUrl: string;
  server: Server;
  close: () => Promise<void>;
};

export async function bootTestApi(): Promise<TestApi> {
  assertTestDatabase();
  applyTestEnv();

  const restoreFetch = installFetchStub();

  const { startApiServer } = await import('../../server/apiServer.js');
  const server = await startApiServer({
    port: 0,
    inProcessWorkers: false,
    geoIp: false,
    expirySweep: false,
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server,
    close: async () => {
      // `close()` sozinho só para de aceitar conexões novas: os sockets keep-alive do fetch
      // manteriam o handle aberto e o runner travaria sem `--test-force-exit`.
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      restoreFetch();
      const { closeMongoConnection } = await import('../../server/db/mongoClient.js');
      await closeMongoConnection();
    },
  };
}
