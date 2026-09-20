import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import type { IndexDescription } from 'mongodb';
import { COLLECTIONS } from '../server/db/constants.js';
import { tenantScopedIndexSpecs } from '../server/db/tenantIndexes.js';
import {
  resolveSharedCollections,
  resolveTenantStorageContextFromIds,
} from '../server/tenancy/tenantStorage.js';
import { buildDocumentOwnershipFilter } from '../server/tenancy/documentOwnership.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

/**
 * Índice TTL não pode liderar por tenant: o Mongo exige campo único sobre a data, e a varredura de
 * expiração é global por natureza. Fica fora da regra de prefixo por impossibilidade, não por
 * escolha — por isso a exceção é esta função, e não uma entrada na lista de motivos.
 */
function isTtlIndex(index: IndexDescription): boolean {
  return (index as { expireAfterSeconds?: number }).expireAfterSeconds !== undefined;
}

describe('modelo de coleções compartilhadas — Passo 7 do plano de escala', () => {
  it('provisionar tenant não cria namespace novo', () => {
    const provision = read('server/services/tenantProvisionService.ts');

    // O laço que criava as 10 coleções do tenant sumiu; sobrou uma garantia do conjunto único.
    assert.ok(provision.includes('ensureSharedCollectionIndexes'));
    assert.equal(provision.includes('listTenantCollectionNames'), false);
    assert.equal(provision.includes('ensureTenantDataIndexes'), false);
  });

  it('nenhum nome de coleção é montado com sufixo de tenant', () => {
    for (const path of ['server/tenancy/tenantStorage.ts', 'server/tenancy/tenantResolver.ts']) {
      const source = read(path);
      assert.equal(
        /\$\{base\}_\$\{prefix\}/.test(source),
        false,
        `${path} ainda monta nome prefixado`,
      );
      assert.equal(source.includes('resolvePrefixedName'), false, `${path} ainda prefixa`);
    }
  });

  it('as coleções resolvidas são exatamente as constantes base', () => {
    const shared = resolveSharedCollections();

    assert.equal(shared.documents, COLLECTIONS.documents);
    assert.equal(shared.documentVersions, COLLECTIONS.documentVersions);
    assert.equal(shared.documentChunks, COLLECTIONS.documentChunks);
    assert.equal(shared.processingJobs, COLLECTIONS.processingJobs);
    assert.equal(shared.auditLogs, COLLECTIONS.auditLogs);

    for (const name of Object.values(shared)) {
      assert.equal(typeof name, 'string');
      assert.equal((name as string).includes('_company'), false);
      assert.equal((name as string).endsWith('_compartilhado'), false);
    }
  });

  it('mil tenants resolvem para o mesmo conjunto de coleções', () => {
    const seen = new Set<string>();

    for (let i = 0; i < 1000; i += 1) {
      const ctx = resolveTenantStorageContextFromIds({
        tenantId: `company_stress_${i}`,
        tenantType: 'business',
      });
      for (const name of Object.values(ctx.collections)) {
        if (name) seen.add(name as string);
      }
    }

    // Era isto que estourava o Atlas: N coleções × N tenants. O que importa é o conjunto não
    // crescer com a quantidade de tenants — o tamanho dele em si pode mudar quando o produto ganha
    // uma coleção, e já mudou (`pending_invite_groups` entrou depois deste teste nascer). Cravar o
    // número aqui só fazia a guarda quebrar por motivo errado, então quem decide é a fonte única.
    const shared = Object.values(resolveSharedCollections()).filter(Boolean);
    assert.deepEqual([...seen].sort(), [...new Set(shared)].sort());
  });

  it('todo índice de dado de tenant lidera por tenantId', () => {
    // Lê os índices de verdade, não o texto do arquivo: a versão em regex não enxergava
    // `expireAfterSeconds` e cobrava prefixo de tenant de um índice TTL, que o Mongo exige que
    // seja de campo único sobre a data. Era uma falha que ninguém podia consertar.
    const groups = tenantScopedIndexSpecs(resolveSharedCollections());
    const all = groups.flatMap((group) =>
      group.indexes.map((index) => ({ collection: group.collection, index })),
    );

    assert.ok(all.length > 20, `esperava dezenas de índices, achei ${all.length}`);
    for (const { collection, index } of all) {
      if (isTtlIndex(index)) continue;
      const first = Object.keys(index.key)[0];
      assert.equal(
        first,
        'tenantId',
        `${collection}: índice liderado por "${first}" não usa o prefixo de tenant e varre o ` +
          `pool inteiro`,
      );
    }
  });

  it('nos demais arquivos de índice, todo prefixo fora do padrão é justificado', async () => {
    // O teste acima cobre só `tenantIndexes.ts`. Estes seis arquivos definem índice de dado de
    // tenant e ficavam fora de qualquer guarda — foi por aí que `documentTenantId` sobreviveu como
    // segundo nome de `tenantId` até 2026-08-13.
    //
    // Nem todo índice deve liderar por tenant, e exigir isso seria errado: quem chega com um token
    // de assinatura ou de convite externo não tem tenant nenhum em mãos. O que esta guarda cobra é
    // que cada exceção esteja NESTA lista, com motivo. Índice novo fora do padrão e fora da lista
    // quebra o teste, que é o ponto.
    const ALLOWED_NON_TENANT_PREFIX: Record<string, string> = {
      // busca por identificador globalmente único — o índice já é seletivo sem o prefixo
      documentId: 'documentId é único no pool inteiro (prefixo doc_)',
      signatureRequestId: 'identificador único da solicitação',
      signatureId: 'identificador único da assinatura',
      // parte externa chega só com o segredo, sem sessão e sem tenant
      signatureTokenHash: 'signatário externo chega apenas com o token',
      inviteTokenHash: 'convidado externo chega apenas com o token',
      verificationCode: 'verificação pública de assinatura, sem sessão',
      // destinatário externo pode receber de vários tenants — cruzar tenant é o propósito
      recipientEmailNormalized: 'destinatário externo recebe de múltiplos tenants',
      recipientEmail:
        'o teto por hora do outbox externo é contado por endereço, e o mesmo endereço pode ' +
        'receber de vários tenants — atravessar tenant é o propósito da contagem',
      channel:
        'espelho do anterior no canal de membro: o teto por hora é por pessoa e por canal, e uma ' +
        'pessoa pertence a mais de um tenant — somar só dentro de um deixaria o teto furado',
      dedupeKey:
        'chave de idempotência do outbox externo: o índice único precisa valer na coleção ' +
        'inteira, senão o mesmo fato entraria uma vez por tenant e a retentativa duplicaria o ' +
        'e-mail, que é exatamente o que ele existe para impedir',
      'signers.userId': 'signatário pode ser externo ao tenant do documento',
      requestedByUserId:
        'espelho de signers.userId — a afinidade de contato olha quem esta pessoa chamou para ' +
        'assinar, e o chamado pode estar em outro tenant',
      'signers.emailNormalized': 'idem — busca por e-mail do signatário',
      signerEmailHash: 'idem — histórico do signatário entre tenants',
      // escopo por usuário, que já é mais estreito que o tenant
      userId: 'favoritos e alertas são por usuário, escopo mais estreito que tenant',
      ownerUserId: 'contatos salvos são de uma pessoa, não de uma empresa',
      notificationId: 'identificador único da notificação',
      // varredura de fundo: roda para todos os tenants de uma vez, e é justamente o tenant que
      // ela não pode ter no filtro
      status:
        'trabalho de fundo que atravessa tenants — posição na fila de análise e a varredura ' +
        'diária que vence pedido parado',
      sharedWithUserId: 'concessões recebidas por um usuário',
      sharedByUserId: 'concessões emitidas por um usuário',
    };

    /**
     * Varre o diretório, e não uma lista escrita à mão.
     *
     * A lista fixa envelheceu duas vezes: `documentExpiryAlertIndexes.ts` sumiu quando os alertas
     * viraram notificações, e o teste passou a estourar em vez de conferir. Pior que isso — um
     * arquivo de índice NOVO nunca entrava na lista, então a guarda inteira não o via. Varrer é o
     * que faz "índice novo fora do padrão quebra o teste" ser verdade.
     */
    const indexDir = join(repoRoot, 'server/db');
    const files = readdirSync(indexDir)
      .filter(
        (name) =>
          name.endsWith('Indexes.ts') &&
          // `tenantIndexes.ts` é a máquina que aplica os outros, e o teste acima já o cobre.
          name !== 'tenantIndexes.ts' &&
          // Índice vetorial do Atlas tem outra forma — campos de filtro, não `key: {}` — e já
          // traz `tenantId` entre eles. A regra de prefixo não se aplica.
          name !== 'vectorIndexes.ts',
      )
      .sort();
    assert.ok(files.length >= 6, `esperava vários arquivos de índice, achei ${files.length}`);

    let total = 0;
    const offenders: string[] = [];
    for (const name of files) {
      // Importa o módulo em vez de ler o texto: o `expireAfterSeconds` de um índice TTL não
      // aparece na expressão que capturava só a primeira chave, e a guarda cobrava desses índices
      // um prefixo que o Mongo recusa.
      const mod: Record<string, unknown> = await import(
        `../server/db/${name.replace('.ts', '.js')}`
      );
      const indexes = Object.values(mod)
        .filter((value): value is IndexDescription[] => Array.isArray(value))
        .flat()
        .filter((index): index is IndexDescription =>
          Boolean(index && typeof index === 'object' && 'key' in index),
        );

      assert.ok(
        indexes.length > 0,
        `${name} não declarou índice nenhum — o teste está lendo errado?`,
      );
      total += indexes.length;

      for (const index of indexes) {
        if (isTtlIndex(index)) continue;
        const first = Object.keys(index.key)[0];
        if (first === 'tenantId') continue;
        if (first in ALLOWED_NON_TENANT_PREFIX) continue;
        // Junta tudo antes de falhar: com `assert` dentro do laço, a primeira violação escondia
        // todas as outras e cada rodada revelava uma só.
        offenders.push(`${name}: índice liderado por "${first}"`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `índice que não lidera por tenantId e não consta na lista de exceções justificadas. Ou ` +
        `ponha tenantId na frente, ou acrescente a exceção com o motivo:\n  ${offenders.join('\n  ')}`,
    );
    assert.ok(total > 20, `esperava dezenas de índices nos arquivos varridos, achei ${total}`);
  });

  it('nenhum arquivo de índice ressuscita documentTenantId como segundo nome de tenantId', () => {
    // O trio documentTenantId/documentTenantType/documentCollection era denormalização do modelo
    // por tenant: guardava onde o documento morava. Depois do Passo 7 a coleção é sempre a mesma,
    // `documentCollection` virou campo morto (7 escritas, 0 leituras) e `documentTenantId` era só
    // `tenantId` com outro nome — invisível para toda auditoria que procura `tenantId`.
    const files = [
      'server/db/types.ts',
      'server/db/documentShareGrantsIndexes.ts',
      'server/db/externalDocumentShareGrantsIndexes.ts',
      'server/db/documentSignatureIndexes.ts',
      'server/db/userDocumentFavoritesIndexes.ts',
    ];

    for (const file of files) {
      const source = read(file);
      assert.ok(
        !source.includes('documentTenantId'),
        `${file} voltou a usar documentTenantId — use tenantId, é o mesmo conceito`,
      );
      assert.ok(
        !source.includes('documentCollection'),
        `${file} voltou a usar documentCollection — a coleção é sempre a mesma desde o Passo 7`,
      );
    }
  });

  it('o conjunto duplicado de índices por ownerTenantId foi removido', () => {
    const indexes = read('server/db/tenantIndexes.ts');

    // ownerTenantId recebe o mesmo valor de tenantId na gravação: manter os dois conjuntos
    // dobraria os namespaces, justo o custo que este passo corta.
    assert.equal(indexes.includes('sharedIndividualIndexSpecs'), false);
    assert.equal(indexes.includes('ensureSharedIndividualIndexes'), false);
  });

  it('o filtro de tenant não tem escapatória para documento sem dono', () => {
    const ownership = read('server/tenancy/documentOwnership.ts');

    assert.equal(
      ownership.includes('$exists: false'),
      false,
      'ramo para documento sem tenantId vaza todo o pool',
    );

    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'company_x',
      tenantType: 'business',
    });
    // Só `tenantId`: um `$or` no escopo era apagado por qualquer busca que gravasse o próprio `$or`.
    assert.deepEqual(buildDocumentOwnershipFilter(ctx), { tenantId: 'company_x' });
  });
});
