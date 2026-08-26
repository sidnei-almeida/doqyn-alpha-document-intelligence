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

    assert.ok(query.includes('listOperationalTenantMembers'));
    assert.ok(query.includes('listApprovalRequests'));
    assert.ok(query.includes('export type PendingApprovalDto'));
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
