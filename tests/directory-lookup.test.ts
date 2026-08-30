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

  it('a busca tem teto e avisa que transbordou, sem contar quantos são', () => {
    const service = read('server/services/directory/directoryLookupService.ts');
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    // O teto é passado adiante: sem isso o padrão do cliente interno decidiria sozinho.
    assert.ok(service.includes('export const DIRECTORY_SEARCH_LIMIT = 8'));
    assert.ok(service.includes('searchDirectoryUsersByUsername(prefix, DIRECTORY_SEARCH_LIMIT)'));

    // `hasMore` sai da contagem antes do filtro de colega de casa: depois dele, oito removidos
    // pareceriam "nada encontrado" num prefixo que transbordou.
    const hasMore = service.indexOf('const hasMore = hits.length >= DIRECTORY_SEARCH_LIMIT');
    const filter = service.indexOf('.filter((hit) => hit.id !== user.id');
    assert.ok(hasMore > 0 && filter > hasMore);

    // A lista não empurra o formulário: altura travada e rolagem própria.
    assert.ok(field.includes('max-h-56 overflow-y-auto'));

    // O aviso diz o que fazer, e não quantos são: a contagem total é o que um diretório
    // varrível entregaria de graça.
    assert.ok(field.includes('Digite mais letras para estreitar'));
    assert.ok(!field.includes('search.data?.total'));
  });

  it('o resultado da busca é reconhecível: retrato, nome, apelido e e-mail', () => {
    const service = read('server/services/directory/directoryLookupService.ts');
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    // Sem retrato ativo não há URL: uma que responde 404 faria a linha piscar imagem quebrada.
    assert.ok(service.includes("hit.avatarStatus === 'active'"));
    assert.ok(service.includes('buildProfileAvatarUrl'));

    assert.ok(field.includes('<UserAvatar'));
    assert.ok(field.includes('@{hit.username} · {hit.email}'));
  });

  it('a rota está registrada no despachante, que é mantido à mão', () => {
    const apiServer = read('server/apiServer.ts');
    const handler = read('api/directory/lookup.ts');

    assert.ok(apiServer.includes("'/api/directory/lookup'"));
    // Aberta a qualquer autenticado, como a busca de membros: quem envia precisa dela.
    assert.ok(handler.includes('requireDocumentAuthContext'));
  });
});

describe('diretório DOQYN — o campo que atravessa a fronteira', () => {
  it('só pergunta quando o texto já é um e-mail inteiro', () => {
    const hook = read('src/features/directory/hooks/useDirectoryLookup.ts');

    // Disparar a cada tecla queimaria a cota de quem está apenas digitando.
    assert.ok(hook.includes('enabled: enabled && valid'));
    assert.ok(hook.includes('looksLikeEmail'));
  });

  it('o campo é próprio, e não o mesmo da busca de colegas', () => {
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    // Aquele procura por nome numa lista conhecida; este resolve e-mail exato contra o diretório,
    // porque o nome de quem está fora é guardado cifrado.
    assert.ok(field.includes("const [email, setEmail] = useState('')"));
    // E a saída para quem não tem conta é opcional: nem todo fluxo oferece link com token.
    assert.ok(field.includes('onFallbackToLink?:'));
  });

  it('a tela não conta que a pessoa tem conta DOQYN quando não há o que oferecer', () => {
    const field = read('src/features/directory/components/CrossTenantRecipientField.tsx');

    // O servidor colapsa `doqyn_user` em `external` com a chave desligada, então o caso nem chega.
    assert.ok(field.includes("lookup.data.kind === 'doqyn_user'"));
    assert.ok(field.includes('Esse e-mail não tem conta DOQYN.'));
  });
});
