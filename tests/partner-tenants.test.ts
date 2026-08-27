import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const SERVICE = 'server/services/directory/partnerTenantsService.ts';

describe('empresas com quem já se trocou documentos', () => {
  it('é histórico derivado, não agenda mantida à mão', () => {
    const service = read(SERVICE);

    // Uma lista mantida à mão envelheceria e ofereceria gente que já saiu.
    assert.ok(service.includes("'inbound.status': 'accepted'"));
    // Antes do aceite não há parceria: houve oferta, e ela pode ter sido recusada.
    assert.ok(!service.includes("'inbound.status': 'pending'"));
  });

  it('não entrega a rede de parceiros dos outros', () => {
    const service = read(SERVICE);

    // `document_requests` é coleção compartilhada: filtrar só por "veio de outro tenant"
    // devolveria os pedidos que empresas alheias fizeram entre si.
    assert.ok(service.includes("'requestedFrom.userId': { $in: memberUserIds }"));
    assert.ok(service.includes('await listOperationalTenantMembers(tenantId)'));
    // E as concessões saem sempre com um dos dois lados sendo o tenant de quem consulta.
    assert.ok(service.includes("$or: [{ tenantId }, { 'inbound.recipientTenantId': tenantId }]"));
  });

  it('a oferta guarda os dois e-mails, senão a segunda conversa recomeça do zero', () => {
    const types = read('server/db/types.ts');
    const share = read('server/services/sharing/documentShareService.ts');

    assert.ok(types.includes('sharedByEmail?: string'));
    assert.ok(types.includes('recipientEmail?: string'));
    // Quem envia sabe o e-mail que digitou; quem recebe, o de quem enviou.
    assert.ok(share.includes('recipientEmail: input.sharedWithEmail?.trim().toLowerCase()'));
  });

  it('reenviar para quem ainda não decidiu atualiza a oferta, não cria outra', () => {
    const share = read('server/services/sharing/documentShareService.ts');
    const persist = share.slice(
      share.indexOf('async function persistShareGrant'),
      share.indexOf('export async function grantRequesterAccessToFulfilledDocument'),
    );

    // `activeGrantFilter` esconde o pendente de propósito; usá-lo aqui tentaria inserir uma segunda
    // concessão e bateria no índice único — 500 no lugar de "já foi enviado".
    assert.ok(!persist.includes('activeGrantFilter({ documentId, sharedWithUserId })'));
    assert.ok(persist.includes('const existing = await collection.findOne({'));
    assert.ok(persist.includes("sharedWithUserId,\n    status: 'active',"));
  });

  it('a peça é uma só, e serve os três verbos', () => {
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    // A lista de parceiras vive dentro do campo: quem procura alguém de fora é exatamente quem
    // precisa lembrar com quem já falou.
    assert.ok(field.includes('<PartnerContactList onPick={setEmail} />'));

    for (const modal of [
      'src/features/sharing/components/ShareDocumentModal.tsx',
      'src/features/signature/RequestSignatureModal.tsx',
      'src/features/requests/components/RequestDocumentModal.tsx',
    ]) {
      assert.ok(read(modal).includes('<CrossTenantRecipientField'), modal);
    }
  });
});
