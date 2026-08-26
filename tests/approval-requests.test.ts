import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('pedidos de aprovação — modelo', () => {
  it('coleção approval_requests com índice de fila e de quem decide', () => {
    const constants = read('server/db/constants.ts');
    const indexes = read('server/db/approvalRequestIndexes.ts');
    const setup = read('server/db/setupMongo.ts');

    assert.ok(constants.includes("approvalRequests: 'approval_requests'"));
    assert.ok(indexes.includes('tenantId: 1, status: 1, createdAt: 1'));
    assert.ok(indexes.includes('decidableBy: 1'));
    assert.ok(setup.includes('ensureApprovalRequestIndexes'));
  });

  it('o pedido carrega quem pode decidir e o que reexecutar', () => {
    const types = read('server/db/types.ts');

    assert.ok(types.includes('export type MongoApprovalRequest'));
    assert.ok(types.includes('decidableBy: string[]'));
    // `payload` é o que torna o pedido reentrante: quem aprova não tem o contexto de quem pediu.
    assert.ok(types.includes('payload: Record<string, unknown>'));
    assert.ok(types.includes("export type ApprovalRequestStatus = 'pending' | 'approved'"));
  });
});

describe('pedidos de aprovação — política de aprovador', () => {
  it('resolveApprovers é o único lugar que conhece a política', () => {
    const service = read('server/services/approvals/approvalRequestService.ts');

    assert.ok(service.includes('export async function resolveApprovers'));
    assert.ok(service.includes("tenantRoles.includes('company_admin')"));
    // Resolvida na criação e congelada no registro — trocar a política não reescreve a fila.
    assert.ok(service.includes('const decidableBy = await resolveApprovers(input.tenantId)'));
  });

  it('decidir exige estar na lista, motivo ao recusar, e não acontece duas vezes', () => {
    const service = read('server/services/approvals/approvalRequestService.ts');

    assert.ok(service.includes('APPROVAL_REQUEST_ACCESS_DENIED'));
    assert.ok(service.includes('APPROVAL_REASON_REQUIRED'));
    assert.ok(service.includes('APPROVAL_REQUEST_SETTLED'));
    // A corrida entre dois administradores é resolvida no banco, não na leitura anterior.
    assert.ok(service.includes("status: 'pending' },"));
  });
});

describe('pedidos de aprovação — fila', () => {
  it('a fusão das origens acontece no servidor, não no navegador', () => {
    const query = read('server/services/approvals/pendingApprovalsQuery.ts');
    const handler = read('api/approval-requests/index.ts');

    assert.ok(query.includes('listApprovalRequests'));
    assert.ok(query.includes('export type PendingApprovalDto'));
    // Os membros entram por parâmetro: `listGovernanceMembers` precisa do `req` e do ator, e
    // arrastar a requisição HTTP para dentro do serviço não vale o acoplamento.
    assert.ok(query.includes('members: GovernanceMemberRecord[]'));
    assert.ok(handler.includes('listGovernanceMembers'));
  });

  it('quem não administra o tenant recebe fila vazia, não erro', () => {
    const query = read('server/services/approvals/pendingApprovalsQuery.ts');
    assert.ok(query.includes("!input.platformRoles.includes('company_admin')"));
    assert.ok(query.includes('return { items: [], nextCursor: null }'));
  });

  it('as duas rotas estão registradas no dispatcher', () => {
    const server = read('server/apiServer.ts');
    assert.ok(server.includes("'/api/approval-requests'"));
    assert.ok(server.includes('approval-requests\\/([^/]+)\\/decide'));
    assert.ok(server.includes("paramKeys: ['requestId']"));
  });

  it('a decisão vira evento na trilha', () => {
    const handler = read('api/approval-requests/[requestId]/decide.ts');
    assert.ok(handler.includes('emitTrackingEvent'));
    assert.ok(handler.includes('approval.request_approved'));
    assert.ok(handler.includes('approval.request_rejected'));
  });
});

describe('pedidos de aprovação — origens fundidas', () => {
  it('o detalhe do pedido de acesso vem por chave interna, não do navegador', () => {
    const client = read('server/integrations/doqynAuthInternalClient.ts');
    const query = read('server/services/approvals/pendingApprovalsQuery.ts');
    const spa = read('src/features/audit/api/pendingApprovalsApi.ts');

    assert.ok(client.includes('/internal/tenants/'));
    assert.ok(client.includes('access-requests'));
    assert.ok(query.includes('loadAccessRequestDetails'));
    // O SPA não fala mais direto com o auth-service para montar a fila.
    assert.ok(!spa.includes('authServiceJson'));
    assert.ok(!spa.includes('usersApi.list'));
  });

  it('falha ao enriquecer não derruba a fila', () => {
    const query = read('server/services/approvals/pendingApprovalsQuery.ts');
    assert.ok(query.includes('logger.warn'));
    assert.ok(query.includes('return [];'));
  });

  it('a coleção antiga de envios continua sendo lida enquanto o fluxo não migra', () => {
    const query = read('server/services/approvals/pendingApprovalsQuery.ts');
    const handler = read('api/approval-requests/index.ts');
    const decide = read('api/approval-requests/[requestId]/decide.ts');

    assert.ok(query.includes('mapLegacyUploadApproval'));
    assert.ok(handler.includes('listPendingDocumentUploadApprovals'));
    // Um endpoint só para o cliente: quem sabe qual serviço executa o efeito é o servidor.
    assert.ok(decide.includes('approveDocumentUploadApproval'));
    assert.ok(decide.includes('rejectDocumentUploadApproval'));
  });
});

describe('pedidos de aprovação — avisos', () => {
  it('dois tipos novos, sem preferência para desligar', () => {
    const types = read('server/db/notificationTypes.ts');
    const prefs = read('server/services/notifications/notificationPreferences.ts');

    assert.ok(types.includes("| 'approval_requested'"));
    assert.ok(types.includes("| 'approval_decided'"));
    assert.ok(prefs.includes('approval_requested: null'));
    assert.ok(prefs.includes('approval_decided: null'));
  });

  it('aviso vai a quem decide na criação, e a quem pediu na decisão', () => {
    const notif = read('server/services/notifications/approvalNotifications.ts');
    const service = read('server/services/approvals/approvalRequestService.ts');
    const decide = read('api/approval-requests/[requestId]/decide.ts');

    assert.ok(notif.includes('recipients: request.decidableBy'));
    assert.ok(notif.includes('recipients: [request.requestedBy.userId]'));
    // A chave carrega a decisão: aprovado e recusado são fatos distintos.
    assert.ok(notif.includes('`${request._id}:${request.status}`'));
    assert.ok(service.includes('notifyApprovalRequested'));
    assert.ok(decide.includes('notifyApprovalDecided'));
  });

  it('falhar o aviso não derruba a ação que o originou', () => {
    const notif = read('server/services/notifications/approvalNotifications.ts');
    assert.ok(notif.includes('async function safely'));
  });
});
