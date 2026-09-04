import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const SERVICE = 'server/services/requests/documentRequestService.ts';

describe('pedir documento a outra empresa', () => {
  it('membro de casa é resolvido antes de perguntar ao diretório', () => {
    const service = read(SERVICE);
    const fn = service.slice(
      service.indexOf('async function resolveRequestedFromEmail'),
      service.indexOf('async function resolveRequesterTenantName'),
    );

    const interno = fn.indexOf('external: false');
    const guarda = fn.indexOf('if (!isInterTenantSharingEnabled())');
    const remoto = fn.indexOf('await lookupDirectoryUserByEmail(email)');

    assert.ok(interno > 0 && guarda > interno && remoto > guarda);
    assert.ok(fn.includes('REQUEST_TARGET_NOT_DOQYN'));
  });

  it('pedido para fora não tem categoria de destino', () => {
    const service = read(SERVICE);
    const types = read('server/db/types.ts');

    // O documento vai nascer e morar no acervo de quem envia: impor categoria daqui prometeria um
    // destino que ele nunca terá.
    assert.ok(service.includes('? { categoryId: undefined, categoryName: undefined }'));
    assert.ok(types.includes('categoryId?: string'));
    // E a checagem de permissão de quem pede cai junto, porque não há dispensa a sustentar.
    assert.ok(service.includes('if (category.categoryId) {'));
  });

  it('a lista de recebidos não filtra por empresa; a de enviados, sim', () => {
    const service = read(SERVICE);

    // Um pedido feito por outra empresa nasce no tenant de quem pediu; filtrar pelo da sessão o
    // esconderia de quem tem de atendê-lo.
    assert.ok(service.includes("input.direction === 'sent'"));
    assert.ok(service.includes('? { tenantId: input.tenantId, [ownerField]: input.userId }'));
    assert.ok(service.includes(': { [ownerField]: input.userId }'));
  });

  it('cumprir um pedido de fora não exige mesmo tenant', () => {
    const service = read(SERVICE);
    const fn = service.slice(service.indexOf('export async function resolveRequestForFulfillment'));

    // Quem autoriza é o pedido ser dele, não o recorte de empresa.
    assert.ok(fn.includes('collection.findOne({ _id: requestId })'));
    assert.ok(fn.includes('REQUEST_FULFILL_DENIED'));
  });

  it('a entrega de fora nasce pendente, esperando o aceite de quem pediu', () => {
    const share = read('server/services/sharing/documentShareService.ts');
    const confirm = read('server/services/confirmAnalysisService.ts');

    assert.ok(share.includes('crossTenant?: boolean'));
    assert.ok(share.includes('inbound: input.crossTenant'));
    // O aviso sai da própria concessão pendente: são dois fatos, atendido e a decidir.
    assert.ok(share.includes('notify: input.crossTenant === true'));
    assert.ok(confirm.includes('const crossTenant = Boolean(fulfilledRequest.crossTenant)'));
  });

  it('o aviso alcança quem está em outra empresa', () => {
    const notify = read('server/services/notifications/documentRequestNotifications.ts');
    const repo = read('server/services/tenantMemberRepository.ts');

    // A notificação é gravada com tenantId e o sino consulta por tenantId mais userId: sem saber
    // as empresas da pessoa, o aviso ia para uma caixa que ela não abre.
    assert.ok(notify.includes('await findActiveTenantIdsForUser(request.requestedFrom.userId)'));
    assert.ok(repo.includes('export async function findActiveTenantIdsForUser'));
    // Um aviso por caixa, e não um descartado como repetido.
    assert.ok(notify.includes('eventKey: `${request._id}:${tenantId}`'));
  });

  it('o mesmo conserto vale para o que chega por compartilhamento', () => {
    const inbound = read('server/services/notifications/inboundShareNotifications.ts');

    // `inbound.recipientTenantId` só é preenchido no aceite: usá-lo no envio gravava o aviso num
    // tenant vazio, e a campainha ficava muda com a caixa cheia.
    assert.ok(inbound.includes('await findActiveTenantIdsForUser(grant.sharedWithUserId)'));
    assert.ok(inbound.includes('eventKey: `${grant._id}:${tenantId}`'));
  });

  it('o aviso de atendido não promete acesso antes do aceite', () => {
    const notify = read('server/services/notifications/documentRequestNotifications.ts');
    const list = read('src/features/notifications/components/NotificationList.tsx');

    // Sem `documentId`, porque o link levaria a uma ficha que a autorização recusa.
    assert.ok(
      notify.includes('...(crossTenant ? {} : { documentId: request.fulfilledDocumentId })'),
    );
    assert.ok(
      list.includes(
        "notification.type === 'document_request_fulfilled' && !notification.documentId",
      ),
    );
  });

  it('a tela mostra de que empresa veio o pedido', () => {
    const page = read('src/features/requests/DocumentRequestsPage.tsx');
    const modal = read('src/features/requests/components/RequestDocumentModal.tsx');

    // Um nome sozinho não diz a quem se está entregando documento.
    assert.ok(page.includes('item.crossTenant.requesterTenantName'));
    assert.ok(page.includes('fora do seu acervo'));
    // Duas origens, não duas telas. O valor inicial deixou de ser literal porque em PF não há
    // origem interna — o tenant tem um usuário só —, mas as duas continuam no mesmo modal.
    assert.ok(modal.includes("useState<'internal' | 'external'>(defaultScope)"));
    assert.ok(modal.includes("['internal', 'Alguém da empresa']"));
    assert.ok(modal.includes("['external', 'De fora daqui']"));
    assert.ok(modal.includes('requestedFromEmail'));
    // E a categoria some quando o destino é fora.
    assert.ok(modal.includes('{external ? null : ('));
  });
});
