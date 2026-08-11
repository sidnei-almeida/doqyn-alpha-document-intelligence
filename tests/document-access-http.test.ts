import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  cleanupFixtures,
  plantBusinessTenant,
  plantDocument,
} from './helpers/documentFixtures.js';
import {
  bootTestApi,
  buildForgedSession,
  registerForgedSession,
  sessionCookie,
  type TestApi,
} from './helpers/integrationApi.js';

/**
 * Matriz de acesso a documento sobre HTTP real.
 *
 * Um único tenant de negócio com dois donos distintos: sonda cross-tenant ou cross-usuário-PF
 * devolve 404, não 403, porque `buildDocumentOwnershipFilter` corta antes da camada de permissão.
 */

const TENANT_ID = 'company_test_p1';
const OWNER_ID = 'user_owner_p1';
const INTRUDER_ID = 'user_intruder_p1';
const INTRUDER_TOKEN = 'session_token_intruder_p1';

let api: TestApi;
let documentId: string;

before(async () => {
  await plantBusinessTenant(TENANT_ID);
  const doc = await plantDocument({ tenantId: TENANT_ID, ownerUserId: OWNER_ID });
  documentId = doc._id;

  registerForgedSession(
    INTRUDER_TOKEN,
    buildForgedSession({
      userId: INTRUDER_ID,
      email: 'intruso@teste.doqyn',
      tenantId: TENANT_ID,
      membershipId: 'mem_intruder_p1',
      roles: ['user'],
    }),
  );

  api = await bootTestApi();
});

after(async () => {
  await cleanupFixtures();
  await api?.close();
});

describe('acesso a documento sobre HTTP real', () => {
  it('nega preview para usuário do mesmo tenant que não é dono', async () => {
    const response = await fetch(
      `${api.baseUrl}/api/documents/preview?documentId=${documentId}`,
      { headers: { Cookie: sessionCookie(INTRUDER_TOKEN) } },
    );

    const body = (await response.json()) as { code?: string };

    // Afirmar status **e** code exatos: sem essa precisão uma falha de infraestrutura
    // (502 AUTH_SERVICE_UNAVAILABLE quando o stub de fetch não pega) passaria como negação.
    assert.equal(response.status, 403);
    assert.equal(body.code, 'DOCUMENT_ACCESS_DENIED');
  });
});
