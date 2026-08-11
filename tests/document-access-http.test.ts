import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AuthUser } from '../server/auth/types.js';
import { resolveDocumentPermissions } from '../server/tenancy/documentAccess.js';
import { buildGovernanceAccessIndex } from '../server/tenancy/governanceAccessIndex.js';
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
 * Um teste que afirmasse 403 nesses cenários falharia pelo motivo certo e enganaria quem lesse.
 *
 * Toda afirmação verifica status **e** `code` exatos. Sem essa precisão uma falha de infraestrutura
 * (502 `AUTH_SERVICE_UNAVAILABLE` quando o stub de fetch não pega) passaria como negação bem
 * sucedida.
 */

const TENANT_ID = 'company_test_p1';
const OWNER_ID = 'user_owner_p1';
const VERSION_ID_PREFIX = 'ver_';

type Probe = { label: string; token: string; userId: string; roles: string[] };

/** Perfis que NÃO podem acessar o documento de terceiro. */
const INTRUDERS: Probe[] = [
  {
    label: 'usuário comum',
    token: 'session_token_intruder_p1',
    userId: 'user_intruder_p1',
    roles: ['user'],
  },
  {
    label: 'papel de plataforma doqyn_admin',
    token: 'session_token_doqyn_admin_p1',
    userId: 'user_doqyn_admin_p1',
    roles: ['doqyn_admin'],
  },
  {
    label: 'papel individual_admin',
    token: 'session_token_individual_admin_p1',
    userId: 'user_individual_admin_p1',
    roles: ['individual_admin'],
  },
];

/** Perfis que DEVEM enxergar o documento na listagem. */
const INSIDERS: Probe[] = [
  {
    label: 'dono do documento',
    token: 'session_token_owner_p1',
    userId: OWNER_ID,
    roles: ['user'],
  },
  {
    label: 'company_admin do mesmo tenant (D-01)',
    token: 'session_token_company_admin_p1',
    userId: 'user_company_admin_p1',
    roles: ['company_admin'],
  },
];

let api: TestApi;
let documentId: string;
let versionId: string;

before(async () => {
  await plantBusinessTenant(TENANT_ID);
  const doc = await plantDocument({ tenantId: TENANT_ID, ownerUserId: OWNER_ID });
  documentId = doc._id;
  versionId = `${VERSION_ID_PREFIX}${documentId}`;

  for (const probe of [...INTRUDERS, ...INSIDERS]) {
    registerForgedSession(
      probe.token,
      buildForgedSession({
        userId: probe.userId,
        email: `${probe.userId}@teste.doqyn`,
        tenantId: TENANT_ID,
        membershipId: `mem_${probe.userId}`,
        roles: probe.roles,
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
  const body = (await response.json()) as { code?: string; items?: Array<{ documentId: string }> };
  return { status: response.status, body };
}

describe('negação de acesso a documento sobre HTTP real', () => {
  for (const intruder of INTRUDERS) {
    describe(intruder.label, () => {
      it('recebe 403 em GET /api/documents/preview', async () => {
        const { status, body } = await getJson(
          `/api/documents/preview?documentId=${documentId}`,
          intruder.token,
        );

        assert.equal(status, 403);
        assert.equal(body.code, 'DOCUMENT_ACCESS_DENIED');
      });

      it('recebe 403 em GET /api/documents/download', async () => {
        const { status, body } = await getJson(
          `/api/documents/download?documentId=${documentId}`,
          intruder.token,
        );

        assert.equal(status, 403);
        assert.equal(body.code, 'DOCUMENT_ACCESS_DENIED');
      });

      // O manifesto do viewer protegido serve o conteúdo página a página (D-22): é o lugar mais
      // provável de um bypass sobreviver, porque não passa pelo mesmo handler do preview.
      it('recebe 403 no manifesto do viewer protegido', async () => {
        const { status, body } = await getJson(
          `/api/documents/${documentId}/versions/${versionId}/preview/manifest`,
          intruder.token,
        );

        assert.equal(status, 403);
        assert.equal(body.code, 'DOCUMENT_ACCESS_DENIED');
      });

      it('não enxerga o documento em GET /api/documents', async () => {
        const { status, body } = await getJson('/api/documents', intruder.token);

        assert.equal(status, 200);
        const ids = (body.items ?? []).map((item) => item.documentId);
        assert.equal(
          ids.includes(documentId),
          false,
          `documento ${documentId} não deveria aparecer para ${intruder.label}`,
        );
      });
    });
  }
});

describe('acesso legítimo preservado', () => {
  for (const insider of INSIDERS) {
    it(`${insider.label} enxerga o documento em GET /api/documents`, async () => {
      const { status, body } = await getJson('/api/documents', insider.token);

      assert.equal(status, 200);
      const ids = (body.items ?? []).map((item) => item.documentId);
      assert.equal(
        ids.includes(documentId),
        true,
        `documento ${documentId} deveria aparecer para ${insider.label}`,
      );
    });
  }
});

/**
 * As afirmações abaixo chamam `resolveDocumentPermissions` diretamente — execução de função real,
 * não leitura de arquivo-fonte.
 *
 * O perfil "manager legado com platformRoles vazio" só existe neste nível: `mapRolesToAuthRole`
 * deriva `role` de `platformRoles`, então uma sessão com `roles: []` produz `role: 'user'` e o
 * caminho legado é inalcançável por HTTP.
 */
describe('resolveDocumentPermissions — ciclo de vida e governança', () => {
  const ownDoc = {
    ownerUserId: OWNER_ID,
    classId: 'cat_test_contratos',
    access: {
      viewGroupIds: [],
      downloadGroupIds: [],
      updateGroupIds: [],
      auditGroupIds: [],
      shareGroupIds: [],
    },
  };

  const thirdPartyDoc = { ...ownDoc, ownerUserId: 'user_outro_p1' };

  it('dono sem papel de plataforma administra o próprio documento (D-20)', () => {
    const owner: AuthUser = {
      id: OWNER_ID,
      email: 'owner@teste.doqyn',
      name: 'Dono',
      companyId: TENANT_ID,
      tenantId: TENANT_ID,
      role: 'user',
      platformRoles: ['user'],
    };

    const perms = resolveDocumentPermissions(owner, ownDoc, []);

    assert.equal(perms.canUpdate, true);
    assert.equal(perms.canTrash, true);
    assert.equal(perms.canEditMetadata, true);
    assert.equal(perms.canTransferOwnership, true);
  });

  it('papel legado manager não abre documento de terceiro (D-03)', () => {
    const legacyManager: AuthUser = {
      id: 'user_legacy_manager_p1',
      email: 'manager@teste.doqyn',
      name: 'Manager legado',
      companyId: TENANT_ID,
      tenantId: TENANT_ID,
      role: 'manager',
      platformRoles: [],
    };

    const perms = resolveDocumentPermissions(legacyManager, thirdPartyDoc, []);

    assert.equal(perms.canPreview, false);
    assert.equal(perms.canDownload, false);
    assert.equal(perms.canUpdate, false);
    assert.equal(perms.canTrash, false);
    assert.equal(perms.canEditMetadata, false);
  });

  it('governança "view" continua concedendo preview e não concede update (D-05)', () => {
    const governanceIndex = buildGovernanceAccessIndex([
      {
        categoryId: 'cat_test_contratos',
        groupId: 'group_financeiro',
        active: true,
        permissions: { view: true, download: false, upload: false, share: false, manage: false },
      },
    ]);

    const viewer: AuthUser = {
      id: 'user_governanca_p1',
      email: 'governanca@teste.doqyn',
      name: 'Governança',
      companyId: TENANT_ID,
      tenantId: TENANT_ID,
      role: 'user',
      platformRoles: ['user'],
    };

    const perms = resolveDocumentPermissions(
      viewer,
      thirdPartyDoc,
      ['group_financeiro'],
      governanceIndex,
    );

    assert.equal(perms.canPreview, true);
    assert.equal(perms.canDownload, false);
    assert.equal(perms.canUpdate, false);
  });
});
