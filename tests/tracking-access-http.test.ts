import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  cleanupFixtures,
  plantBusinessTenant,
  plantDocument,
  plantIndividualTenant,
} from './helpers/documentFixtures.js';
import {
  bootTestApi,
  buildForgedSession,
  registerForgedSession,
  sessionCookie,
  type TestApi,
} from './helpers/integrationApi.js';

/**
 * Matriz de tracking sobre HTTP real.
 *
 * Toda afirmação verifica status **e** `code` exatos. Um teste que afirmasse apenas "não é 200"
 * deixaria um 502 `AUTH_SERVICE_UNAVAILABLE` — stub de fetch que não pegou — passar como negação
 * bem sucedida, que é a armadilha T-01-11.
 *
 * Dois tenants: um de negócio com dois donos, e um PF com um único usuário. A sonda cross-usuário
 * no pool PF devolve **404**, não 403, porque o filtro de propriedade corta antes da camada de
 * permissão — por isso não há afirmação de 403 para esse caso.
 */

const TENANT_ID = 'company_test_p2';
const OWNER_ID = 'user_owner_p2';

const PF_TENANT_ID = 'tenant_pf_test_p2';
const PF_USER_ID = 'user_pf_p2';

type Probe = {
  label: string;
  token: string;
  userId: string;
  roles: string[];
  tenantId?: string;
  tenantType?: 'business' | 'individual';
};

/**
 * Perfis do mesmo tenant de negócio, sem propriedade e sem `company_admin`.
 *
 * O terceiro carrega `platformRoles` vazio para exercitar o papel legado. Vale o mesmo registro
 * feito no plano 01-01: `mapRolesToAuthRole` deriva `role` de `platformRoles`, então sobre HTTP
 * esta sessão vira `role: 'user'`. A afirmação continua provando que não há bypass; o caminho
 * legado propriamente dito é coberto por chamada direta em `document-tracking-rbac.test.ts`.
 */
const INTRUDERS: Probe[] = [
  {
    label: 'papel de plataforma doqyn_admin',
    token: 'session_tracking_doqyn_admin_p2',
    userId: 'user_doqyn_admin_p2',
    roles: ['doqyn_admin'],
  },
  {
    label: 'papel individual_admin em tenant de negócio',
    token: 'session_tracking_individual_admin_p2',
    userId: 'user_individual_admin_p2',
    roles: ['individual_admin'],
  },
  {
    label: 'papel legado manager com platformRoles vazio',
    token: 'session_tracking_legacy_manager_p2',
    userId: 'user_legacy_manager_p2',
    roles: [],
  },
];

const COMPANY_ADMIN: Probe = {
  label: 'company_admin do tenant',
  token: 'session_tracking_company_admin_p2',
  userId: 'user_company_admin_p2',
  roles: ['company_admin'],
};

const OWNER: Probe = {
  label: 'dono do documento',
  token: 'session_tracking_owner_p2',
  userId: OWNER_ID,
  roles: ['user'],
};

const PF_USER: Probe = {
  label: 'usuário único de tenant PF',
  token: 'session_tracking_pf_p2',
  userId: PF_USER_ID,
  roles: [],
  tenantId: PF_TENANT_ID,
  tenantType: 'individual',
};

let api: TestApi;
let documentId: string;
let versionId: string;
let pfDocumentId: string;

before(async () => {
  await plantBusinessTenant(TENANT_ID);
  const doc = await plantDocument({ tenantId: TENANT_ID, ownerUserId: OWNER_ID });
  documentId = doc._id;
  versionId = `ver_${documentId}`;

  await plantIndividualTenant(PF_TENANT_ID, PF_USER_ID);
  const pfDoc = await plantDocument({ tenantId: PF_TENANT_ID, ownerUserId: PF_USER_ID });
  pfDocumentId = pfDoc._id;

  for (const probe of [...INTRUDERS, COMPANY_ADMIN, OWNER, PF_USER]) {
    registerForgedSession(
      probe.token,
      buildForgedSession({
        userId: probe.userId,
        email: `${probe.userId}@teste.doqyn`,
        tenantId: probe.tenantId ?? TENANT_ID,
        membershipId: `mem_${probe.userId}`,
        roles: probe.roles,
        tenantType: probe.tenantType,
      }),
    );
  }

  api = await bootTestApi();
});

after(async () => {
  await cleanupFixtures();
  await api?.close();
});

async function getJson(path: string, token: string) {
  const response = await fetch(`${api.baseUrl}${path}`, {
    headers: { Cookie: sessionCookie(token) },
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

describe('GET /api/tracking/summary — negação', () => {
  for (const intruder of INTRUDERS) {
    it(`${intruder.label} recebe 403 TRACKING_FORBIDDEN`, async () => {
      const { status, body } = await getJson('/api/tracking/summary', intruder.token);

      assert.equal(status, 403);
      assert.equal(body.code, 'TRACKING_FORBIDDEN');
    });
  }

  it('dono do documento não vê o tracking agregado do tenant inteiro', async () => {
    const { status, body } = await getJson('/api/tracking/summary', OWNER.token);

    assert.equal(status, 403);
    assert.equal(body.code, 'TRACKING_FORBIDDEN');
  });
});

describe('GET /api/tracking/summary — acesso legítimo', () => {
  it('company_admin recebe 200 (D-01)', async () => {
    const { status, body } = await getJson('/api/tracking/summary', COMPANY_ADMIN.token);

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
  });

  // Sem este caminho, tirar `individual_admin` do set de admin trancaria o tenant PF fora do
  // próprio tracking — a regressão auto-infligida T-01-10.
  it('usuário único de tenant PF recebe 200 sem papel administrativo nenhum', async () => {
    const { status, body } = await getJson('/api/tracking/summary', PF_USER.token);

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
  });
});

describe('GET /api/tracking/document-events — escopo por documento (D-07)', () => {
  it('o dono vê a trilha do próprio documento', async () => {
    const { status, body } = await getJson(
      `/api/tracking/document-events?documentId=${documentId}`,
      OWNER.token,
    );

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
    assert.ok(Array.isArray(body.items));
  });

  it('o usuário de tenant PF vê a trilha do próprio documento', async () => {
    const { status, body } = await getJson(
      `/api/tracking/document-events?documentId=${pfDocumentId}`,
      PF_USER.token,
    );

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
  });

  for (const intruder of INTRUDERS) {
    it(`${intruder.label} recebe 403 TRACKING_FORBIDDEN no documento de terceiro`, async () => {
      const { status, body } = await getJson(
        `/api/tracking/document-events?documentId=${documentId}`,
        intruder.token,
      );

      assert.equal(status, 403);
      assert.equal(body.code, 'TRACKING_FORBIDDEN');
    });
  }

  it('intruso sem documento em escopo recebe 403 TRACKING_FORBIDDEN', async () => {
    const { status, body } = await getJson('/api/tracking/document-events', INTRUDERS[0].token);

    assert.equal(status, 403);
    assert.equal(body.code, 'TRACKING_FORBIDDEN');
  });
});

describe('GET /api/documents/:documentId/timeline — escopo por documento (D-07)', () => {
  it('o dono vê a linha do tempo do próprio documento', async () => {
    const { status, body } = await getJson(`/api/documents/${documentId}/timeline`, OWNER.token);

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
  });

  for (const intruder of INTRUDERS) {
    it(`${intruder.label} recebe 403 TRACKING_FORBIDDEN no documento de terceiro`, async () => {
      const { status, body } = await getJson(
        `/api/documents/${documentId}/timeline`,
        intruder.token,
      );

      assert.equal(status, 403);
      assert.equal(body.code, 'TRACKING_FORBIDDEN');
    });
  }
});

/**
 * O manifesto do viewer protegido serve o conteúdo página a página (D-22): é onde um bypass tem
 * mais chance de sobreviver despercebido, porque não passa pelo handler do preview.
 */
describe('manifesto do viewer protegido (D-22)', () => {
  // O intruso nem chega a receber manifesto: o plano 01-01 fechou o acesso ao documento. Afirmar
  // `canViewTracking: false` no corpo só faria sentido se ele passasse do 403 — e ele não passa.
  for (const intruder of INTRUDERS) {
    it(`${intruder.label} é barrado com 403 DOCUMENT_ACCESS_DENIED`, async () => {
      const { status, body } = await getJson(
        `/api/documents/${documentId}/versions/${versionId}/preview/manifest`,
        intruder.token,
      );

      assert.equal(status, 403);
      assert.equal(body.code, 'DOCUMENT_ACCESS_DENIED');
    });
  }

  /**
   * Dono e `company_admin` atravessam a autorização e param depois dela, em `VERSION_NOT_FOUND`: a
   * fixture planta o documento mas não a linha de `document_versions` que o manifesto renderiza.
   * O par status+code exato é o que distingue "passou pela autorização" de "foi barrado" — por isso
   * a afirmação não é a forma fraca `status !== 403`.
   */
  for (const allowed of [OWNER, COMPANY_ADMIN]) {
    it(`${allowed.label} atravessa a autorização do manifesto`, async () => {
      const { status, body } = await getJson(
        `/api/documents/${documentId}/versions/${versionId}/preview/manifest`,
        allowed.token,
      );

      assert.equal(status, 404);
      assert.equal(body.code, 'VERSION_NOT_FOUND');
    });
  }
});

/**
 * `canViewTracking` é montado por três serviços (`documentListItems`, `documentService`,
 * `documentPreviewManifestService`). A listagem é onde o campo é observável num 200, então é aqui
 * que o termo de propriedade de D-07 fica provado ponta a ponta.
 */
describe('canViewTracking na listagem — termo de propriedade (D-07)', () => {
  it('o dono recebe canViewTracking true no próprio documento', async () => {
    const { status, body } = await getJson('/api/documents', OWNER.token);

    assert.equal(status, 200);
    const items = body.items as Array<{
      documentId: string;
      permissions?: { canViewTracking?: boolean };
    }>;
    const item = items.find((entry) => entry.documentId === documentId);
    assert.ok(item, 'o dono deveria enxergar o próprio documento na listagem');
    assert.equal(item.permissions?.canViewTracking, true);
  });

  it('company_admin recebe canViewTracking true (D-01)', async () => {
    const { status, body } = await getJson('/api/documents', COMPANY_ADMIN.token);

    assert.equal(status, 200);
    const items = body.items as Array<{
      documentId: string;
      permissions?: { canViewTracking?: boolean };
    }>;
    const item = items.find((entry) => entry.documentId === documentId);
    assert.ok(item, 'company_admin deveria enxergar o documento na listagem');
    assert.equal(item.permissions?.canViewTracking, true);
  });

  it('o usuário de tenant PF recebe canViewTracking true no próprio documento', async () => {
    const { status, body } = await getJson('/api/documents', PF_USER.token);

    assert.equal(status, 200);
    const items = body.items as Array<{
      documentId: string;
      permissions?: { canViewTracking?: boolean };
    }>;
    const item = items.find((entry) => entry.documentId === pfDocumentId);
    assert.ok(item, 'o usuário PF deveria enxergar o próprio documento na listagem');
    assert.equal(item.permissions?.canViewTracking, true);
  });
});

/**
 * Ciclo de vida do tenant: as configurações de lixeira são governança de tenant, não de documento.
 * Sem o caminho PF de `userGovernsTenantScope` o usuário de tenant PF ficaria trancado fora das
 * próprias configurações — a outra metade da regressão T-01-10.
 */
describe('GET /api/settings/trash-retention — governança de tenant', () => {
  it('company_admin recebe 200 (D-01)', async () => {
    const { status, body } = await getJson('/api/settings/trash-retention', COMPANY_ADMIN.token);

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
  });

  it('usuário único de tenant PF recebe 200 sem papel administrativo nenhum', async () => {
    const { status, body } = await getJson('/api/settings/trash-retention', PF_USER.token);

    assert.equal(status, 200);
    assert.equal(body.code, undefined);
  });

  it('o dono de documento em tenant de negócio recebe 403 TRASH_SETTINGS_FORBIDDEN', async () => {
    const { status, body } = await getJson('/api/settings/trash-retention', OWNER.token);

    assert.equal(status, 403);
    assert.equal(body.code, 'TRASH_SETTINGS_FORBIDDEN');
  });

  for (const intruder of INTRUDERS) {
    it(`${intruder.label} recebe 403 TRASH_SETTINGS_FORBIDDEN`, async () => {
      const { status, body } = await getJson('/api/settings/trash-retention', intruder.token);

      assert.equal(status, 403);
      assert.equal(body.code, 'TRASH_SETTINGS_FORBIDDEN');
    });
  }
});

/**
 * D-08: o parâmetro de tenant deixou de existir na superfície HTTP. O servidor não o lê, então
 * anexá-lo não muda nada — nem para conceder, nem para negar.
 */
describe('parâmetro de tenant apagado da superfície HTTP (D-08)', () => {
  // `from`/`to` explícitos porque o corpo do summary carrega o período resolvido: sem eles a janela
  // é derivada do relógio e as duas respostas diferem por milissegundos, não por escopo.
  const PERIODO = 'from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z';

  it('company_admin com tenant alheio na querystring recebe o mesmo corpo', async () => {
    const semQuery = await getJson(`/api/tracking/summary?${PERIODO}`, COMPANY_ADMIN.token);
    const comQuery = await getJson(
      `/api/tracking/summary?${PERIODO}&tenantId=${PF_TENANT_ID}`,
      COMPANY_ADMIN.token,
    );

    assert.equal(semQuery.status, 200);
    assert.equal(comQuery.status, 200);
    assert.deepEqual(comQuery.body, semQuery.body);
  });

  it('intruso com tenant alheio na querystring continua recebendo 403 TRACKING_FORBIDDEN', async () => {
    const semQuery = await getJson('/api/tracking/summary', INTRUDERS[0].token);
    const comQuery = await getJson(
      `/api/tracking/summary?tenantId=${PF_TENANT_ID}`,
      INTRUDERS[0].token,
    );

    assert.equal(comQuery.status, 403);
    assert.equal(comQuery.body.code, 'TRACKING_FORBIDDEN');
    assert.deepEqual(comQuery.body, semQuery.body);
  });

  it('GET /api/documents com tenant alheio na querystring devolve o mesmo corpo', async () => {
    const semQuery = await getJson('/api/documents', OWNER.token);
    const comQuery = await getJson(`/api/documents?tenantId=${PF_TENANT_ID}`, OWNER.token);

    assert.equal(semQuery.status, 200);
    assert.equal(comQuery.status, 200);
    assert.deepEqual(comQuery.body, semQuery.body);
  });
});
