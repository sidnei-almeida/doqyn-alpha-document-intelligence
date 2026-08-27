import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const SERVICE = 'server/services/sharing/documentShareService.ts';

describe('compartilhar entre empresas — a segunda dimensão do verbo', () => {
  it('membro de casa é resolvido antes de perguntar ao diretório', () => {
    const service = read(SERVICE);
    const resolver = service.slice(
      service.indexOf('async function resolveShareRecipient'),
      service.indexOf('function resolveShareExpiration'),
    );

    const internal = resolver.indexOf("scope: 'internal'");
    const remote = resolver.indexOf('await lookupDirectoryUserByEmail(email)');
    assert.ok(internal > 0 && remote > internal);
  });

  it('sem a chave ligada, o destino de fora nem é consultado', () => {
    const service = read(SERVICE);
    const resolver = service.slice(service.indexOf('async function resolveShareRecipient'));

    const guard = resolver.indexOf('if (!isInterTenantSharingEnabled())');
    const remote = resolver.indexOf('await lookupDirectoryUserByEmail(email)');
    assert.ok(guard > 0 && remote > guard);
    // E quem digita um e-mail de fora recebe alternativa, não um beco.
    assert.ok(resolver.includes('SHARE_RECIPIENT_OUTSIDE_TENANT'));
    assert.ok(resolver.includes('SHARE_RECIPIENT_NOT_DOQYN'));
  });

  it('para fora a aprovação é piso, não default', () => {
    const service = read(SERVICE);

    // A governança decide dentro de casa; atravessar a fronteira exige aprovação de qualquer jeito.
    assert.ok(
      service.includes('requiresApproval || (crossesTenantBorder && !isDocumentAdmin(user))'),
    );
    // Administrador é a exceção porque é quem aprovaria.
    assert.ok(service.includes('isDocumentAdmin(user)'));
  });

  it('a concessão que atravessa a fronteira nasce pendente', () => {
    const service = read(SERVICE);

    assert.ok(service.includes('inbound: crossesTenantBorder'));
    assert.ok(service.includes('await buildInboundState('));

    const builder = service.slice(
      service.indexOf('async function buildInboundState'),
      service.indexOf('function assertSharePermissions'),
    );
    assert.ok(builder.includes("status: 'pending'"));
    // O tenant de destino é decidido no aceite, não no envio.
    assert.ok(builder.includes("recipientTenantId: ''"));
    assert.ok(builder.includes('originTenantName'));
  });

  it('o aviso do que ainda não foi aceito não se chama compartilhamento', () => {
    const service = read(SERVICE);

    assert.ok(service.includes('if (input.notify !== false && grant.inbound)'));
    assert.ok(service.includes('await notifyInboundShareReceived(grant)'));
    // E o aviso de sempre não sai para o que está pendente.
    assert.ok(service.includes('if (input.notify !== false && !grant.inbound)'));
  });

  it('o prazo tem teto só para o que sai da empresa', () => {
    const service = read(SERVICE);
    const fn = service.slice(
      service.indexOf('function resolveShareExpiration'),
      service.indexOf('async function buildInboundState'),
    );

    assert.ok(fn.includes('if (crossesTenantBorder) {'));
    assert.ok(fn.includes('maxExternalShareExpirationDays'));
    assert.ok(fn.includes('SHARE_EXPIRATION_PAST'));
  });

  it('aprovar não reconsulta o diretório', () => {
    const service = read(SERVICE);
    const fn = service.slice(
      service.indexOf('export async function createShareGrantFromApprovedRequest'),
    );

    // A aprovação é a autorização, e o destinatário já foi nomeado no pedido.
    assert.ok(fn.includes("payload.recipientScope === 'external_tenant'"));
    assert.ok(fn.includes('if (!crossesTenantBorder) {'));
    assert.ok(!fn.includes('lookupDirectoryUserByEmail'));
    // O pedido carrega o que aprovar precisa executar.
    assert.ok(fn.includes('inbound: crossesTenantBorder'));
  });

  it('o pedido de aprovação carrega o destino e o prazo', () => {
    const service = read(SERVICE);

    assert.ok(service.includes('recipientScope: recipient.scope'));
    assert.ok(service.includes('recipientName: recipient.name'));
    assert.ok(service.includes('expiresAt: expiresAt ? expiresAt.toISOString() : null'));
  });

  it('o endpoint aceita e-mail ou id, e um dos dois basta', () => {
    const api = read('api/documents/[documentId]/shares.ts');

    assert.ok(api.includes('sharedWithEmail'));
    assert.ok(api.includes('!body.sharedWithUserId?.trim() && !body.sharedWithEmail?.trim()'));
  });

  it('na tela, quem é de fora não é tratado como membro', () => {
    const modal = read('src/features/sharing/components/ShareDocumentModal.tsx');

    // Fora de `internalPick`: não tem id de associação e o envio nasce pendente do outro lado.
    assert.ok(modal.includes('const [crossTenantPick, setCrossTenantPick]'));
    assert.ok(modal.includes('sharedWithEmail: crossTenantPick.email'));
    // Prazo obrigatório para o que sai da empresa.
    assert.ok(
      modal.includes("(audience === 'internal' && !crossTenantPick) || Boolean(expiresAt)"),
    );
  });

  it('a dica só oferece o caminho entre empresas quando ele existe', () => {
    const hint = read('src/features/directory/components/OutsideCompanyHint.tsx');

    assert.ok(hint.includes('onUseDoqynUser?: (email: string, name: string) => void'));
    // Sem o callback, o usuário DOQYN de fora cai no link externo como qualquer outro.
    assert.ok(hint.includes('if (!onUseDoqynUser) return null'));
    // A tela avisa que o acesso não é imediato.
    assert.ok(hint.includes('ela precisa aceitar'));
  });
});
