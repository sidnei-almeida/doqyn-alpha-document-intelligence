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

describe('requisitar documento — modelo', () => {
  it('a coleção é própria, e não a fila de aprovações', () => {
    const constants = read('server/db/constants.ts');
    const types = read('server/db/types.ts');

    assert.ok(constants.includes("documentRequests: 'document_requests'"));
    assert.ok(types.includes('export type MongoDocumentRequest'));
    // Pedido para alguém **fazer** algo não é pedido para um administrador **decidir** algo.
    // Fundir os dois faria a fila do administrador mostrar trabalho que não é dele.
    assert.ok(types.includes('export type DocumentRequestStatus'));
    assert.ok(types.includes("'pending' | 'fulfilled' | 'cancelled' | 'expired'"));
  });

  it('a categoria de destino é de quem pede', () => {
    const types = read('server/db/types.ts');
    const service = read('server/services/requests/documentRequestService.ts');

    assert.ok(types.includes('categoryId: string;'));
    // Validada na criação: quem recebe não escolhe a categoria, então uma categoria inválida
    // travaria o envio sem que ele pudesse corrigir.
    assert.ok(service.includes('REQUEST_CATEGORY_NOT_FOUND'));
    assert.ok(service.includes('async function resolveCategory'));
  });

  it('os índices atendem as duas direções e a varredura de prazo', () => {
    const indexes = read('server/db/documentRequestIndexes.ts');
    const script = read('scripts/ensure-mongodb-indexes.ts');
    const setup = read('server/db/setupMongo.ts');

    assert.ok(indexes.includes("'requestedFrom.userId': 1"));
    assert.ok(indexes.includes("'requestedBy.userId': 1"));
    assert.ok(indexes.includes('status: 1, dueAt: 1'));
    // O job do Compose é este script, não `setupMongo`.
    assert.ok(script.includes('DOCUMENT_REQUEST_INDEXES'));
    assert.ok(setup.includes('ensureDocumentRequestIndexes'));
  });
});

describe('requisitar documento — regras', () => {
  it('recusa pedido sem destino, sem título e para si mesmo', () => {
    const service = read('server/services/requests/documentRequestService.ts');

    assert.ok(service.includes('REQUEST_TARGET_REQUIRED'));
    assert.ok(service.includes('REQUEST_TARGET_SELF'));
    assert.ok(service.includes('REQUEST_TITLE_REQUIRED'));
  });

  it('o destino é membro ativo do tenant, e é aqui que a Fase F muda', () => {
    const service = read('server/services/requests/documentRequestService.ts');

    assert.ok(service.includes('REQUEST_TARGET_INVALID'));
    assert.ok(service.includes('REQUEST_TARGET_NOT_ACTIVE'));
    // Uma função só conhece a fronteira do tenant; o resto do serviço não.
    assert.ok(service.includes('async function resolveRequestedFrom'));
  });

  it('o prazo tem teto, senão a lista nunca é varrida', () => {
    const service = read('server/services/requests/documentRequestService.ts');

    assert.ok(service.includes('REQUEST_DUE_PAST'));
    assert.ok(service.includes('REQUEST_DUE_TOO_FAR'));
    assert.ok(service.includes('DUE_MAX_DAYS'));
  });

  it('cancelar é de quem pediu, e a corrida é resolvida no banco', () => {
    const service = read('server/services/requests/documentRequestService.ts');

    assert.ok(service.includes('REQUEST_CANCEL_DENIED'));
    assert.ok(service.includes('REQUEST_SETTLED'));
    assert.ok(service.includes("status: 'pending' },"));
  });
});

describe('requisitar documento — rotas', () => {
  it('as duas rotas estão na tabela mantida à mão', () => {
    const server = read('server/apiServer.ts');

    assert.ok(server.includes("'/api/document-requests':"));
    assert.ok(server.includes('document-requests\\/([^/]+)\\/cancel'));
    // A chave é `paramKeys`; `params` seria ignorado e o handler não receberia o id.
    assert.ok(server.includes("paramKeys: ['requestId']"));
  });

  it('a lista não exige papel administrativo', () => {
    const handler = read('api/document-requests/index.ts');

    // Pedir um documento é trabalho do dia, não ato de governança — diferente da fila de
    // aprovações, que devolve vazio para quem não administra o tenant.
    assert.ok(!handler.includes('userCanManageUsers'));
    assert.ok(handler.includes("req.query.direction === 'sent'"));
  });

  it('toda mutação deixa trilha', () => {
    const create = read('api/document-requests/index.ts');
    const cancel = read('api/document-requests/[requestId]/cancel.ts');

    assert.ok(create.includes("action: 'document_request.created'"));
    assert.ok(cancel.includes("action: 'document_request.cancelled'"));
    assert.ok(create.includes('sanitizeAuditMetadata'));
  });
});

describe('requisitar documento — cumprir o pedido', () => {
  it('a categoria do pedido vence a escolha de quem envia e a da IA', () => {
    const confirm = read('server/services/confirmAnalysisService.ts');

    assert.ok(confirm.includes('documentRequestId: optionalName'));
    // Ordem: pedido > escolha humana > IA. Quem envia não escolhe onde o documento cai.
    assert.ok(
      confirm.includes(
        'const manualClassId = fulfilledRequest?.categoryId ?? (data.manualClassId?.trim() || undefined)',
      ),
    );
  });

  it('quem cumpre é o dono do documento, não quem confirma', () => {
    const confirm = read('server/services/confirmAnalysisService.ts');

    // Com revisão de envio ligada, esta função roda de novo com o administrador como ator e o
    // remetente em `documentOwnerUserId`. Usar o ator recusaria com 403 todo envio aprovado.
    assert.ok(
      confirm.includes(
        'resolveRequestForFulfillment(tenantId, ownerUserId, data.documentRequestId',
      ),
    );
    assert.ok(confirm.includes('fulfilledByUserId: ownerUserId'));
  });

  it('pedir é o ato de autorização: quem pediu ganha concessão explícita', () => {
    const share = read('server/services/sharing/documentShareService.ts');

    assert.ok(share.includes('export async function grantRequesterAccessToFulfilledDocument'));
    // Só leitura: o pedido justifica ver o que chegou, não mexer nele.
    assert.ok(share.includes('permissions: { canView: true, canDownload: true, canShare: false }'));
    // Dentro de casa o aviso deste fato é "seu pedido foi atendido", não "documento compartilhado
    // com você". Para fora é a própria concessão pendente que avisa: são dois fatos, atendido e a
    // decidir.
    assert.ok(share.includes('notify: input.crossTenant === true'));
  });

  it('fechar o pedido nunca derruba o envio', () => {
    const confirm = read('server/services/confirmAnalysisService.ts');
    const service = read('server/services/requests/documentRequestService.ts');

    // O binário já está no R2 e o registro no Mongo: estourar aqui perderia o ativo caro por
    // causa da escrituração.
    assert.ok(confirm.includes('falha ao fechar requisição de documento'));
    // A corrida entre dois envios é resolvida no banco, e `null` significa perdida.
    // Sem recorte de empresa: o pedido feito de fora vive no tenant de quem pediu, e quem cumpre
    // está no dele. A condição que resolve a corrida é o `status`.
    assert.ok(service.includes("{ _id: requestId, status: 'pending' }"));
    assert.ok(service.includes('REQUEST_FULFILL_DENIED'));
  });
});

describe('requisitar documento — aviso e tela', () => {
  it('os dois tipos entram no vocabulário, dos dois lados', () => {
    const types = read('server/db/notificationTypes.ts');
    const prefs = read('server/services/notifications/notificationPreferences.ts');
    const client = read('src/features/notifications/api/notificationsApi.ts');
    const list = read('src/features/notifications/components/NotificationList.tsx');

    for (const file of [types, client]) {
      assert.ok(file.includes("'document_requested'"));
      assert.ok(file.includes("'document_request_fulfilled'"));
    }
    // Sem preferência: trabalho atribuído e resposta ao próprio pedido não são aviso de cortesia.
    assert.ok(prefs.includes('document_requested: null'));
    assert.ok(prefs.includes('document_request_fulfilled: null'));
    // O `Record` por tipo quebra o build se um tipo novo não ganhar ícone e rótulo.
    assert.ok(list.includes('document_requested:'));
    assert.ok(list.includes('document_request_fulfilled:'));
  });

  it('o pedido sem documento leva à lista, não a uma Biblioteca sem o item', () => {
    const list = read('src/features/notifications/components/NotificationList.tsx');

    // Enquanto ninguém envia não há arquivo, e o `documentId` ausente devolveria `null`.
    assert.ok(list.includes("if (notification.type === 'document_requested') return '/pedidos'"));
  });

  it('um fato, um aviso', () => {
    const notifications = read('server/services/notifications/documentRequestNotifications.ts');
    const share = read('server/services/sharing/documentShareService.ts');

    assert.ok(notifications.includes('document_request_fulfilled'));
    // Dentro de casa a concessão criada junto não avisa: seriam dois avisos do mesmo
    // acontecimento, um deles chamando de "compartilhamento" o que foi uma entrega.
    assert.ok(share.includes('notify: input.crossTenant === true'));
  });

  it('a lista mora ao lado da Biblioteca, e não dentro dela', () => {
    const routes = read('src/app/routes.tsx');
    const nav = read('src/lib/constants.ts');

    // `/biblioteca/:collection` lista documentos, e um pedido só vira documento quando alguém
    // envia — entrar lá como coleção obrigaria a mentir para `DocumentListItem`.
    assert.ok(routes.includes("path: '/pedidos'"));
    assert.ok(nav.includes("path: '/pedidos'"));
  });

  it('a pessoa é identificada pelo id do auth, não pelo da associação', () => {
    const api = read('src/features/users/api/usersApi.ts');

    // O servidor manda os dois; o mapa os descartava, e todo filtro de "sou eu" ou "é o dono"
    // comparava membershipId com userId e nunca casava.
    assert.ok(api.includes('userId: member.userId ?? member.authUserId'));
  });
});

describe('requisitar documento — prazo', () => {
  it('a varredura é uma escrita só, não um laço por tenant', () => {
    const service = read('server/services/requests/documentRequestService.ts');
    const queue = read('server/queues/expiryAlertQueue.ts');

    assert.ok(service.includes('export async function expireOverdueDocumentRequests'));
    // Coleção compartilhada com `tenantId` no registro: o índice { status, dueAt } existe para
    // esta consulta, e varrer tenant a tenant faria N leituras onde uma basta.
    assert.ok(service.includes("{ status: 'pending', dueAt: { $lte: now } }"));
    assert.ok(queue.includes('expireOverdueDocumentRequests'));
  });

  it('só a varredura completa vence pedido', () => {
    const queue = read('server/queues/expiryAlertQueue.ts');

    // A reavaliação sob demanda de um tenant é sobre vencimento de documento, e retorna antes.
    const onDemandReturn = queue.indexOf('if (payload.tenantId) {');
    const sweepExpire = queue.indexOf('expireOverdueDocumentRequests()');
    assert.ok(onDemandReturn > 0 && sweepExpire > onDemandReturn);
  });

  it('falha ao vencer não derruba a varredura de documentos', () => {
    const queue = read('server/queues/expiryAlertQueue.ts');

    assert.ok(queue.includes('falha ao vencer requisições de documento'));
    assert.ok(queue.includes('requestsExpired'));
  });
});

describe('requisitar documento — o que a revisão apontou', () => {
  it('a lista de pessoas vem de rota aberta, não da listagem de membros', () => {
    const page = read('src/features/requests/DocumentRequestsPage.tsx');

    // `useCompanyMembers` só dispara para quem administra o tenant, e a rota devolve 403 aos
    // demais: com aquela fonte o seletor vinha vazio para quem mais precisa dele. O nome ainda
    // aparece no comentário que explica a troca — o que não pode voltar é o import.
    assert.ok(!page.includes("from '@/features/users/hooks/useCompanyMembers'"));
    assert.ok(page.includes('searchShareableUsers'));
  });

  it('cumprir tem caminho na tela, e o pedido viaja no contexto do item', () => {
    const page = read('src/features/requests/DocumentRequestsPage.tsx');
    const types = read('src/features/upload/types.ts');
    const provider = read('src/features/upload/UploadQueueProvider.tsx');
    const client = read('src/features/document-send/services/confirmAnalysis.ts');

    assert.ok(page.includes("label: 'Enviar documento'"));
    assert.ok(types.includes('documentRequestId?: string'));
    assert.ok(provider.includes('documentRequestId: item.context?.documentRequestId'));
    // Vale para os dois caminhos: confirmação direta e envio para aprovação.
    assert.ok(client.split('documentRequestId: options?.documentRequestId').length === 3);
  });

  it('a categoria pode vir de três lugares, e as guardas conhecem os três', () => {
    const guard = read('src/features/document-send/services/normalizeConfirmPayload.ts');
    const drawer = read('src/features/upload/review/ReviewDrawer.tsx');
    const submit = read('server/services/documentUploadApprovalService.ts');

    // Exigir só a classe da IA anulava no cliente o resgate manual que o servidor oferece.
    assert.ok(guard.includes('fallback?.manualClassId'));
    assert.ok(guard.includes('fallback?.documentRequestId'));
    assert.ok(drawer.includes('!fulfillsRequest'));
    // Mesma ordem do confirm: pedido > escolha humana > IA.
    assert.ok(
      submit.includes(
        'fulfilledRequest?.categoryId ?? data.manualClassId?.trim() ?? data.classification.classId',
      ),
    );
  });

  it('pedir é o ato de autorização: cumprir dispensa permissão na categoria de destino', () => {
    const submit = read('server/services/documentUploadApprovalService.ts');

    // O RH pede o comprovante ao funcionário, e o funcionário não tem — nem deve ter — permissão
    // de enviar na categoria do RH.
    assert.ok(submit.includes('if (!fulfilledRequest) {'));
    assert.ok(submit.includes('assertCanSubmitToCategory({'));
  });

  it('e o ato de autorizar exige a autorização: quem pede tem de alcançar a categoria', () => {
    const service = read('server/services/requests/documentRequestService.ts');

    // Sem isto, duas pessoas sem alcance na categoria pedem uma à outra e depositam nela com a
    // permissão de envio dispensada dos dois lados.
    assert.ok(service.includes('await assertUserCanSubmitToCategoryId({'));
    assert.ok(service.includes('Você não tem permissão para pedir documentos nesta categoria.'));

    // A regra é a mesma dos dois lados, e mora num lugar só.
    const shared = read('server/services/categoryUploadPermission.ts');
    assert.ok(shared.includes('export function userCanSubmitToCategory'));
    assert.ok(shared.includes('export async function assertUserCanSubmitToCategoryId'));
    // Categoria sem grupo de atualização é aberta: regra ausente não é regra que nega.
    assert.ok(shared.includes('if (!categoryAccess.updateGroupIds.length) return;'));
  });

  it('o documento entregue é alcançado pela concessão, e o link aponta para lá', () => {
    const list = read('src/features/notifications/components/NotificationList.tsx');
    const page = read('src/features/requests/DocumentRequestsPage.tsx');

    // A listagem principal não carrega concessões; só "Compartilhados comigo" carrega.
    assert.ok(list.includes("notification.type === 'document_request_fulfilled'"));
    assert.ok(page.includes('function fulfilledDocumentPath'));
    assert.ok(page.includes('/biblioteca/compartilhados?documentId='));
  });

  it('o prazo é ancorado em UTC, senão as duas telas discordam por um dia', () => {
    const modal = read('src/features/requests/components/RequestDocumentModal.tsx');
    assert.ok(modal.includes('T23:59:59Z'));
  });

  it('cursor inválido é 400, não 500', () => {
    const service = read('server/services/requests/documentRequestService.ts');
    assert.ok(service.includes('REQUEST_CURSOR_INVALID'));
  });

  it('a compensação não fala mais alto que a falha que a causou', () => {
    const decide = read('api/approval-requests/[requestId]/decide.ts');
    // Reabrir devolve o pedido ao índice único parcial; um E11000 aqui dentro esconderia o erro real.
    assert.ok(decide.includes('falha ao devolver pedido à fila'));
  });

  it('o aprovador vê o que está concedendo', () => {
    const query = read('server/services/approvals/pendingApprovalsQuery.ts');
    const dialog = read('src/features/audit/components/PendingApprovalReviewDialog.tsx');

    assert.ok(query.includes('function readSharePermissions'));
    assert.ok(dialog.includes('O que será concedido'));
    assert.ok(dialog.includes("item.grants?.canDownload ? 'Ver e baixar' : 'Somente ver'"));
  });
});
