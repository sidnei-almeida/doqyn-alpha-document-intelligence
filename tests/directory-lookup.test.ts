import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('diretório DOQYN — a fronteira do e-mail', () => {
  it('a projeção que vem do auth-service é a mínima, e a resposta uniforme atravessa', () => {
    const client = read('server/integrations/doqynAuthInternalClient.ts');

    // `found` decide; o corpo é o mesmo dos dois lados, e virar `null` aqui preserva isso.
    assert.ok(client.includes('lookupDirectoryUserByEmail'));
    assert.ok(client.includes('result.found ? (result.user ?? null) : null'));
    assert.ok(client.includes('/internal/users/lookup?email='));

    // Nada além de id e nome de exibição atravessa a fronteira.
    const typeStart = client.indexOf('export type DirectoryUserSnapshot');
    const snapshot = client.slice(typeStart, client.indexOf('};', typeStart));
    assert.ok(snapshot.includes('id: string'));
    assert.ok(snapshot.includes('displayName: string'));
    assert.ok(!snapshot.includes('whatsapp'));
    assert.ok(!snapshot.includes('email: string'));
  });

  it('membro do mesmo tenant é resolvido antes de perguntar para fora', () => {
    const service = read('server/services/directory/directoryLookupService.ts');

    const memberBranch = service.indexOf("kind: 'tenant_member'");
    const quota = service.indexOf('await assertLookupQuota(user.id)');
    const remote = service.indexOf('await lookupDirectoryUserByEmail(email)');

    assert.ok(memberBranch > 0 && quota > memberBranch);
    assert.ok(remote > quota);
  });

  it('os três destinos existem, e o de fora não é erro', () => {
    const service = read('server/services/directory/directoryLookupService.ts');

    assert.ok(service.includes("kind: 'tenant_member'"));
    assert.ok(service.includes("kind: 'doqyn_user'"));
    assert.ok(service.includes("kind: 'external'"));
    // Quem não tem conta cai no link com token, que já existe — 200, não 404.
    assert.ok(service.includes("return { kind: 'external' }"));
  });

  it('o teto é por quem consulta, e sobrevive ao Redis desligado', () => {
    const service = read('server/services/directory/directoryLookupService.ts');

    // Por e-mail alvo não protegeria de nada: quem enumera varre e-mails diferentes.
    assert.ok(service.includes('`directory:lookup:${userId}:${window}`'));
    assert.ok(service.includes('`directory:lookup:${userId}:${day}`'));
    // Rajada e varredura lenta são ataques diferentes e precisam de dois baldes.
    assert.ok(service.includes('const BURST_LIMIT'));
    assert.ok(service.includes('const DAILY_LIMIT'));
    // Sem Redis o limite continua valendo, ainda que só por processo.
    assert.ok(service.includes('incrementInMemory'));
    assert.ok(service.includes('DIRECTORY_LOOKUP_RATE_LIMITED'));
  });

  it('enquanto o envio entre empresas não existe, ter conta responde como não ter', () => {
    const service = read('server/services/directory/directoryLookupService.ts');
    const config = read('server/config/interTenantConfig.ts');

    // O colapso é no serviço, não na tela: a rota é chamável direto por qualquer autenticado.
    assert.ok(service.includes('if (!found || !isInterTenantSharingEnabled())'));
    assert.ok(config.includes("process.env.INTERTENANT_SHARING_ENABLED === 'true'"));

    // A cota é gasta antes do colapso: a pergunta chegou a sair para o auth-service.
    const quota = service.indexOf('await assertLookupQuota(user.id)');
    const collapse = service.indexOf('!isInterTenantSharingEnabled()');
    assert.ok(quota > 0 && collapse > quota);
  });

  it('a rota está registrada no despachante, que é mantido à mão', () => {
    const apiServer = read('server/apiServer.ts');
    const handler = read('api/directory/lookup.ts');

    assert.ok(apiServer.includes("'/api/directory/lookup'"));
    // Aberta a qualquer autenticado, como a busca de membros: quem envia precisa dela.
    assert.ok(handler.includes('requireDocumentAuthContext'));
  });
});

describe('diretório DOQYN — a saída na tela', () => {
  it('só pergunta quando a busca de dentro de casa já falhou', () => {
    const hook = read('src/features/directory/hooks/useDirectoryLookup.ts');
    const picker = read('src/features/documents/recipients/RecipientFlow.tsx');

    // Disparar a cada tecla queimaria a cota de quem está apenas digitando.
    assert.ok(hook.includes('enabled: enabled && valid'));
    assert.ok(hook.includes('looksLikeEmail'));
    // O slot só é renderizado quando a lista de membros voltou vazia.
    assert.ok(picker.includes('emptyAction?: ReactNode'));
    assert.ok(picker.includes('{emptyAction}'));
  });

  it('a saída existe nos dois fluxos que param na fronteira da empresa', () => {
    const share = read('src/features/sharing/components/ShareDocumentModal.tsx');
    const signature = read('src/features/signature/RequestSignatureModal.tsx');

    for (const modal of [share, signature]) {
      assert.ok(modal.includes('<OutsideCompanyHint'));
      // Trocar de aba sem carregar o e-mail digitado devolveria o trabalho a quem usa.
      assert.ok(modal.includes("setAudience('external')"));
      assert.ok(modal.includes('{ ...EMPTY_EXTERNAL_RECIPIENT, email }'));
    }

    assert.ok(signature.includes('intent="signature"'));
  });

  it('a tela não conta que a pessoa tem conta DOQYN', () => {
    const hint = read('src/features/directory/components/OutsideCompanyHint.tsx');

    // Enquanto a Fase D não existe, isso seria a saída do oráculo sem nada em troca. O servidor já
    // colapsa; a tela também não trata o caso.
    assert.ok(!hint.includes("=== 'doqyn_user'"));
    assert.ok(hint.includes("lookup.data.kind !== 'external'"));
  });
});
