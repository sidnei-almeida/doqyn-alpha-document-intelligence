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
    // As duas origens que restam: as aprovações no formato novo e os envios que ainda não
    // migraram. O ramo de pessoa saiu junto com o pedido de acesso.
    assert.ok(query.includes('mapLegacyUploadApproval'));
    assert.ok(handler.includes('listPendingDocumentUploadApprovals'));
    assert.equal(query.includes('GovernanceMemberRecord'), false);
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
  it('o SPA não fala direto com o auth-service para montar a fila', () => {
    const spa = read('src/features/audit/api/pendingApprovalsApi.ts');
    assert.ok(!spa.includes('authServiceJson'));
    assert.ok(!spa.includes('usersApi.list'));
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

describe('governança — terceiro estado', () => {
  it('o valor gravado aceita require, e a leitura passa pelo normalizador', () => {
    const shared = read('shared/governancePermissions.ts');
    const types = read('server/db/types.ts');

    assert.ok(shared.includes("export type GovernancePermissionValue = boolean | 'require'"));
    // Só o verbo que tem portão oferece o meio-termo: sem caminho para pedir, o estado trancaria
    // a porta sem campainha.
    assert.ok(shared.includes("REQUIRABLE_PERMISSIONS = ['download', 'share']"));
    assert.ok(shared.includes("REQUIRABLE_WHEN_GATED = ['update']"));
    assert.ok(types.includes('view: GovernancePermissionValue'));
  });

  it('ler não aceita o meio-termo', () => {
    const shared = read('shared/governancePermissions.ts');
    // Exigir aprovação para ver criaria um pedido por documento consultado.
    assert.ok(!shared.includes("'view',\n  'download'"));
    assert.ok(shared.includes('normalizePermissionState'));
    const service = read('server/services/documentAccessRulesService.ts');
    assert.ok(service.includes('normalizePermissions'));
  });

  it('canX falha fechado: require não conta como pode agora', () => {
    const access = read('server/tenancy/documentAccess.ts');

    assert.ok(
      access.includes("const canDownload = isAdmin || isOwner || downloadState === 'allow'"),
    );
    assert.ok(access.includes('requiresApproval'));
    assert.ok(access.includes('DOCUMENT_APPROVAL_REQUIRED'));
  });

  it('o portão consulta licença aprovada antes de abrir novo pedido', () => {
    const gate = read('server/services/approvals/documentApprovalGate.ts');
    const file = read('server/services/documentFileService.ts');

    assert.ok(gate.includes('APPROVAL_TTL_MS'));
    assert.ok(gate.includes("status: 'approved'"));
    // Pedido pendente não vira um segundo pedido.
    assert.ok(gate.includes("status: 'pending'"));
    // A licença só vale onde aprovar não executa nada; ver o portão de `share`.
    assert.ok(gate.includes('grantsLicense'));
    assert.ok(file.includes('resolveDocumentApproval'));
  });
});

describe('aprovações — armadilhas do modelo', () => {
  it('o único inclui quem pediu, e só vale com documento no assunto', () => {
    const indexes = read('server/db/approvalRequestIndexes.ts');

    // Sem o requerente na chave, o segundo a pedir o mesmo documento não conseguiria pedir.
    assert.ok(indexes.includes("'requestedBy.userId': 1"));
    // Pedido de envio não tem documento, e o Mongo indexa campo ausente como null.
    assert.ok(indexes.includes("'subject.documentId': { $exists: true }"));
    // O índice da primeira versão precisa cair pelo nome: a forma da chave mudou.
    assert.ok(indexes.includes('SUPERSEDED_APPROVAL_REQUEST_INDEXES'));
    // O job do Compose é este script, não `setupMongo`: sem derrubar lá, o índice antigo
    // sobrevive em produção e barra o segundo compartilhamento pendente do mesmo documento.
    const script = read('scripts/ensure-mongodb-indexes.ts');
    assert.ok(script.includes('SUPERSEDED_APPROVAL_REQUEST_INDEXES'));
  });

  it('pedido sem aprovador é recusado, não gravado', () => {
    const service = read('server/services/approvals/approvalRequestService.ts');
    assert.ok(service.includes('APPROVAL_NO_APPROVER'));
  });

  it('a fila é só de documento, e recusar não alcança a pessoa', () => {
    const api = read('src/features/audit/api/pendingApprovalsApi.ts');
    const hook = read('src/features/audit/hooks/useAuditCenter.ts');

    // Sem ramo de pessoa não há como confundir "recusar este download" com "recusar o acesso
    // desta pessoa": a recusa só tem um endpoint para onde ir.
    assert.equal(api.includes('access_request'), false);
    assert.ok(api.includes("type: 'document_upload' | 'document_download' | 'document_share'"));
    assert.equal(hook.includes('usersApi.reject'), false);
  });

  it('compartilhar falha fechado no meio-termo', () => {
    const share = read('server/tenancy/documentShareAccess.ts');
    // `userHasGovernanceCategoryPermission` conta `require` como verdadeiro: usá-lo aqui liberaria
    // o compartilhamento sem passar por ninguém quando `share` voltar a aceitar o meio-termo.
    assert.ok(share.includes('resolveGovernanceCategoryPermission('));
    assert.ok(share.includes("=== \n    'allow'") || share.includes("'allow'"));
    // A menção que sobra é do comentário; a chamada não pode existir.
    assert.ok(!share.includes('if (userHasGovernanceCategoryPermission('));
  });

  it('o destinatário faz parte da identidade do pedido de compartilhamento', () => {
    const indexes = read('server/db/approvalRequestIndexes.ts');
    const service = read('server/services/approvals/approvalRequestService.ts');
    const gate = read('server/services/approvals/documentApprovalGate.ts');

    // Compartilhar o mesmo documento com duas pessoas são dois pedidos.
    assert.ok(indexes.includes("'subject.memberId': 1"));
    assert.ok(service.includes("'subject.memberId': input.subject.memberId ?? null"));
    assert.ok(gate.includes("{ 'subject.memberId': input.targetMemberId }"));
  });

  it('pedir aprovação não aparece como erro', () => {
    const feedback = read('src/shared/feedback/appFeedback.ts');
    assert.ok(feedback.includes("error.code === 'DOCUMENT_APPROVAL_REQUIRED'"));
    assert.ok(feedback.includes("showAppToast({ type: 'info'"));
  });
});

describe('compartilhar — o portão', () => {
  it('o meio-termo abre pedido em vez de 403', () => {
    const access = read('server/tenancy/documentShareAccess.ts');
    const service = read('server/services/sharing/documentShareService.ts');

    assert.ok(access.includes('export function shareRequiresApproval'));
    // Quem já pode por qualquer caminho não pede licença.
    assert.ok(
      access.includes(
        'if (canUserShareDocument(user, doc, memberGroupIds, governanceIndex)) return false',
      ),
    );
    assert.ok(service.includes("kind: 'document_share'"));
    assert.ok(service.includes('DOCUMENT_APPROVAL_REQUIRED'));
  });

  it('o pedido carrega o que precisa para acontecer, validado antes', () => {
    const service = read('server/services/sharing/documentShareService.ts');

    // Destinatário e permissões são conferidos antes do pedido nascer: aprovar não pode falhar
    // por dado que já era inválido quando alguém clicou.
    const gateAt = service.indexOf('resolveDocumentApproval(');
    assert.ok(gateAt > 0);
    // `requireShareRecipient` virou `resolveShareRecipient`, que também resolve o destinatário
    // de outro tenant. Ele continua rodando antes do portão: o pedido não nasce sem que o
    // destinatário exista.
    assert.ok(service.indexOf('resolveShareRecipient(ctx.tenantId, input)') < gateAt);
    assert.ok(service.indexOf('assertSharePermissions(permissions)') < gateAt);
    // O `payload` ganhou o escopo e os dados do destinatário de outro tenant no meio, mas
    // continua carregando tudo que aprovar precisa para executar sem voltar a perguntar.
    for (const field of [
      'sharedWithUserId,',
      'recipientScope:',
      'permissions,',
      'message:',
      'expiresAt:',
    ]) {
      assert.ok(service.includes(field), field);
    }
  });

  it('aprovar executa o compartilhamento, e falhar devolve o pedido à fila', () => {
    const service = read('server/services/sharing/documentShareService.ts');
    const decide = read('api/approval-requests/[requestId]/decide.ts');

    assert.ok(service.includes('export async function createShareGrantFromApprovedRequest'));
    // A concessão sai no nome de quem pediu, não de quem aprovou.
    assert.ok(service.includes('sharedByUserId: request.requestedBy.userId'));
    assert.ok(decide.includes("decided.kind === 'document_share'"));
    assert.ok(decide.includes('reopenApprovalRequest(auth.ctx.tenantId, requestId)'));
    // A trilha do fato é a concessão, e ela fica fora da compensação.
    assert.ok(decide.includes("action: 'document.share_created'"));
  });

  it('a aprovação de compartilhamento não vira licença', () => {
    const service = read('server/services/sharing/documentShareService.ts');
    // Aprovar já compartilhou: tratar o pedido aprovado como passe faria a mesma decisão valer
    // para um segundo compartilhamento que ninguém viu.
    assert.ok(service.includes('grantsLicense: false'));
  });

  it('a tela oferece o pedido em vez de desabilitar a ação', () => {
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    const items = read('server/services/documentListItems.ts');

    assert.ok(items.includes('share: perms.shareRequiresApproval'));
    assert.ok(menu.includes('doc.permissions?.requiresApproval?.share'));
    assert.ok(menu.includes('doc.permissions?.requiresApproval?.download'));
    // Solicitar assinatura não tem portão: continua preso ao `canShare` estrito.
    assert.ok(menu.includes('const canOpenShare'));
  });

  it('o diálogo de governança grava o estado que leu', () => {
    const reader = read('src/features/rules/utils/groupClassPermissions.ts');
    const dialog = read('src/features/rules/components/governance/GovernanceDetailDialog.tsx');

    // Ler só as listas devolveria `true` para uma célula em `require`, e salvar a degradaria.
    assert.ok(reader.includes('category.permissionStates'));
    assert.ok(dialog.includes('isRequirablePermission(DOMAIN_VERB[key])'));
  });
});
