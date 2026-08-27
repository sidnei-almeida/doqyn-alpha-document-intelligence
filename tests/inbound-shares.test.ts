import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('caixa de entrada — o que chega de fora não entra sozinho', () => {
  it('o portão é o filtro por onde todo acesso por concessão passa', () => {
    const service = read('server/services/sharing/documentShareService.ts');

    // Barrar num lugar só é o que impede o item pendente de escapar por um caminho esquecido.
    assert.ok(service.includes("{ inbound: { $exists: false } }, { 'inbound.status': 'accepted' }"));

    // `$and` porque duas chaves `$or` no mesmo objeto se sobrescrevem, e a que morre é a validade.
    const filter = service.slice(
      service.indexOf('function activeGrantFilter'),
      service.indexOf('export async function findActiveShareGrantForUser'),
    );
    assert.ok(filter.includes('$and: ['));
    assert.ok(filter.includes('expiresAt'));
  });

  it('concessão de casa não pede aceite', () => {
    const types = read('server/db/types.ts');

    // `inbound` ausente significa "de dentro do tenant", e vale na hora.
    assert.ok(types.includes('inbound?: InboundShareState'));
    assert.ok(types.includes("export type InboundShareStatus = 'pending' | 'accepted' | 'declined'"));
    assert.ok(types.includes('recipientTenantId: string'));
  });

  it('a oferta viaja na concessão, porque quem recebe não alcança o acervo de origem', () => {
    const types = read('server/db/types.ts');
    const service = read('server/services/sharing/inboundShareService.ts');

    assert.ok(types.includes('documentName: string'));
    assert.ok(types.includes('originTenantName: string'));
    // Serializar lê da oferta, não do documento: consultar o outro tenant é justamente o acesso
    // que o aceite ainda não concedeu.
    assert.ok(service.includes('const offer = grant.inbound!.offer'));
  });

  it('a decisão é do destinatário, não do administrador dele', () => {
    const service = read('server/services/sharing/inboundShareService.ts');

    // Os dois filtros trazem `sharedWithUserId: user.id`.
    const listing = service.slice(service.indexOf('export async function listInboundShares'));
    assert.ok(listing.includes('sharedWithUserId: user.id'));

    const decide = service.slice(service.indexOf('async function decide('), service.indexOf('export async function acceptInboundShare'));
    assert.ok(decide.includes('sharedWithUserId: user.id'));
    // Quem não é o destinatário não descobre por aqui que a concessão existe.
    assert.ok(decide.includes('INBOUND_SHARE_NOT_FOUND'));
  });

  it('dois cliques não viram duas decisões', () => {
    const service = read('server/services/sharing/inboundShareService.ts');
    const decide = service.slice(service.indexOf('async function decide('));

    // A condição vive no próprio update; perder a corrida é 409, não decisão trocada em silêncio.
    assert.ok(decide.includes("'inbound.status': 'pending'"));
    assert.ok(decide.includes('findOneAndUpdate'));
    assert.ok(decide.includes('INBOUND_SHARE_SETTLED'));
  });

  it('recusa avisa quem enviou, e não pede motivo', () => {
    const service = read('server/services/sharing/inboundShareService.ts');
    const notify = read('server/services/notifications/inboundShareNotifications.ts');

    assert.ok(service.includes("notifyInboundShareDecided(grant, 'declined', recipientName)"));
    // O aviso de quem recebe vai para o tenant dele; o da decisão vai para o de origem.
    assert.ok(notify.includes('tenantId: recipientTenantId'));
    assert.ok(notify.includes('tenantId: grant.tenantId'));
    // Sem campo de motivo em lugar nenhum da recusa.
    assert.ok(!service.includes('declineReason'));
  });

  it('o índice da caixa é parcial, senão a escrita de casa paga por ele', () => {
    const indexes = read('server/db/documentShareGrantsIndexes.ts');
    const job = read('scripts/ensure-mongodb-indexes.ts');

    assert.ok(indexes.includes("partialFilterExpression: { 'inbound.status': 'pending' }"));
    // O job do Compose é este; ficar só em `setupMongo` deixaria a coleção sem índice em produção.
    assert.ok(job.includes('DOCUMENT_SHARE_GRANTS_INDEXES'));
    assert.ok(job.includes('SHARED_APP_COLLECTIONS.documentShareGrants'));
  });

  it('as rotas estão no despachante, que é mantido à mão', () => {
    const apiServer = read('server/apiServer.ts');

    assert.ok(apiServer.includes("'/api/inbound-shares'"));
    assert.ok(apiServer.includes('inbound-shares\\/([^/]+)\\/decide'));
    assert.ok(apiServer.includes("paramKeys: ['grantId']"));
  });

  it('a fila mora onde a pessoa já procura, e fora da lista de documentos', () => {
    const page = read('src/features/library/LibraryPage.tsx');
    const strip = read('src/features/sharing/components/InboundSharesStrip.tsx');

    assert.ok(page.includes('{isSharedWithMeView && <InboundSharesStrip />}'));
    // Item pendente não é documento do acervo: some sozinho quando a fila esvazia.
    assert.ok(strip.includes('if (!items.length) return null'));
  });

  it('decidir invalida a Biblioteca junto com a caixa', () => {
    const hooks = read('src/features/sharing/hooks/useInboundShares.ts');

    // Aceitar sem invalidar deixaria o documento liberado no servidor e invisível na tela.
    assert.ok(hooks.includes("queryKey: ['shared-with-me']"));
    assert.ok(hooks.includes('INBOUND_SHARES_QUERY_KEY'));
  });

  it('o aviso do que chegou leva à fila, não ao documento', () => {
    const list = read('src/features/notifications/components/NotificationList.tsx');

    // A ficha recusaria o acesso: o aceite é o que ainda não aconteceu.
    assert.ok(list.includes("if (notification.type === 'inbound_share_received') return '/biblioteca/compartilhados'"));
  });
});
