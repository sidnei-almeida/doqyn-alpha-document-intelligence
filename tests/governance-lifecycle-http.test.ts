import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  cleanupFixtures,
  plantBusinessTenant,
  plantDocument,
  plantDocumentGroupMembership,
  plantGovernanceRule,
} from './helpers/documentFixtures.js';
import {
  bootTestApi,
  buildForgedSession,
  registerForgedSession,
  sessionCookie,
  type TestApi,
} from './helpers/integrationApi.js';

/**
 * D-24 sobre HTTP real: o ciclo de vida do documento é decidido pelo que **o tenant** configurou no
 * mapa de regras, não por papel fixo do backend.
 *
 * Antes desta suíte, `canUpdate`, `canTrash` e `canEditMetadata` eram `isAdmin || isOwner` e nunca
 * consultavam a governança: um grupo com a permissão marcada na categoria não conseguia editar nem
 * arquivar nada. O motor já expunha o verbo; ninguém perguntava.
 *
 * As afirmações passam por request de verdade — listagem e o endpoint de lixeira, que é mutação
 * real. Nada de `assert.ok(source.includes(...))`: inspeção de fonte não distingue "o código chama
 * a governança" de "a governança concede".
 */

const TENANT_ID = 'company_test_gov_p3';
const CATEGORY_ID = 'cat_test_contratos';
const EDITOR_GROUP_ID = 'group_editores_p3';

const OWNER_ID = 'user_owner_gov_p3';
const EDITOR_ID = 'user_editor_gov_p3';
const OUTSIDER_ID = 'user_estranho_gov_p3';

const OWNER_TOKEN = 'session_token_owner_gov_p3';
const EDITOR_TOKEN = 'session_token_editor_gov_p3';
const OUTSIDER_TOKEN = 'session_token_estranho_gov_p3';

type ListPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canUpdate: boolean;
  canEditMetadata: boolean;
};

type ListItem = { documentId: string; permissions?: ListPermissions };

let api: TestApi;

/** Documento usado só para leitura de permissões — nenhum teste o mutila. */
let readOnlyDocumentId: string;
/** Um documento descartável por cenário de arquivamento: mover para lixeira é mutação. */
let trashByEditorDocumentId: string;
let trashByOwnerDocumentId: string;
let trashByOutsiderDocumentId: string;

before(async () => {
  await plantBusinessTenant(TENANT_ID);

  const plant = async () =>
    (await plantDocument({ tenantId: TENANT_ID, ownerUserId: OWNER_ID, classId: CATEGORY_ID }))._id;

  readOnlyDocumentId = await plant();
  trashByEditorDocumentId = await plant();
  trashByOwnerDocumentId = await plant();
  trashByOutsiderDocumentId = await plant();

  // A regra que o admin da empresa configuraria no mapa: o grupo de editores vê e altera a
  // categoria Contratos. `upload` é o nome persistido do verbo `update` (ver GovernancePermissionKey).
  await plantGovernanceRule({
    tenantId: TENANT_ID,
    ownerUserId: OWNER_ID,
    categoryId: CATEGORY_ID,
    groupId: EDITOR_GROUP_ID,
    permissions: { view: true, download: false, upload: true, share: false, manage: false },
  });

  await plantDocumentGroupMembership({
    tenantId: TENANT_ID,
    userId: EDITOR_ID,
    membershipId: `mem_${EDITOR_ID}`,
    groupId: EDITOR_GROUP_ID,
  });

  for (const [token, userId] of [
    [OWNER_TOKEN, OWNER_ID],
    [EDITOR_TOKEN, EDITOR_ID],
    [OUTSIDER_TOKEN, OUTSIDER_ID],
  ] as const) {
    registerForgedSession(
      token,
      buildForgedSession({
        userId,
        email: `${userId}@teste.doqyn`,
        tenantId: TENANT_ID,
        membershipId: `mem_${userId}`,
        roles: ['user'],
      }),
    );
  }

  api = await bootTestApi();
});

after(async () => {
  await cleanupFixtures();
  await api?.close();
});

async function listDocuments(token: string): Promise<ListItem[]> {
  const response = await fetch(`${api.baseUrl}/api/documents`, {
    headers: { Cookie: sessionCookie(token) },
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { items?: ListItem[] };
  return body.items ?? [];
}

async function moveToTrash(documentId: string, token: string) {
  const response = await fetch(`${api.baseUrl}/api/documents/${documentId}/trash`, {
    method: 'POST',
    headers: { Cookie: sessionCookie(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'teste de governança' }),
  });
  const body = (await response.json()) as { code?: string };
  return { status: response.status, body };
}

describe('governança do tenant decide o ciclo de vida do documento (D-24)', () => {
  it('grupo com permissão update obtém canUpdate e canEditMetadata sobre documento de terceiro', async () => {
    const items = await listDocuments(EDITOR_TOKEN);
    const item = items.find((entry) => entry.documentId === readOnlyDocumentId);

    assert.ok(item, `editor deveria enxergar ${readOnlyDocumentId} pela regra de governança`);
    assert.equal(item.permissions?.canUpdate, true);
    assert.equal(item.permissions?.canEditMetadata, true);
    // A regra concede `view`, não `download`: o que o tenant marcou é o que vale, verbo a verbo.
    assert.equal(item.permissions?.canPreview, true);
    assert.equal(item.permissions?.canDownload, false);
  });

  it('grupo com permissão update arquiva o documento — POST trash devolve 200', async () => {
    const { status } = await moveToTrash(trashByEditorDocumentId, EDITOR_TOKEN);

    assert.equal(status, 200);
  });

  it('sem regra e sem propriedade, arquivar continua 403', async () => {
    const { status, body } = await moveToTrash(trashByOutsiderDocumentId, OUTSIDER_TOKEN);

    assert.equal(status, 403);
    assert.equal(body.code, 'DOCUMENT_TRASH_DENIED');
  });

  it('sem regra e sem propriedade, o documento não aparece na listagem', async () => {
    const items = await listDocuments(OUTSIDER_TOKEN);
    const ids = items.map((entry) => entry.documentId);

    assert.equal(
      ids.includes(readOnlyDocumentId),
      false,
      'usuário sem regra de governança não deveria enxergar o documento',
    );
  });
});

describe('propriedade continua bastando (D-20)', () => {
  it('dono sem papel e sem grupo mantém canUpdate e canEditMetadata na listagem', async () => {
    const items = await listDocuments(OWNER_TOKEN);
    const item = items.find((entry) => entry.documentId === readOnlyDocumentId);

    assert.ok(item, 'dono deveria enxergar o próprio documento');
    assert.equal(item.permissions?.canUpdate, true);
    assert.equal(item.permissions?.canEditMetadata, true);
  });

  it('dono arquiva o próprio documento — POST trash devolve 200', async () => {
    const { status } = await moveToTrash(trashByOwnerDocumentId, OWNER_TOKEN);

    assert.equal(status, 200);
  });
});
