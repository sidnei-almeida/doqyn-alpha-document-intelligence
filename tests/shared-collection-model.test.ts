import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { COLLECTIONS } from '../server/db/constants.js';
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

describe('modelo de coleções compartilhadas — Passo 7 do plano de escala', () => {
  it('provisionar tenant não cria namespace novo', () => {
    const provision = read('server/services/tenantProvisionService.ts');

    // O laço que criava as 10 coleções do tenant sumiu; sobrou uma garantia do conjunto único.
    assert.ok(provision.includes('ensureSharedCollectionIndexes'));
    assert.equal(provision.includes('listTenantCollectionNames'), false);
    assert.equal(provision.includes('ensureTenantDataIndexes'), false);
  });

  it('nenhum nome de coleção é montado com sufixo de tenant', () => {
    for (const path of [
      'server/tenancy/tenantStorage.ts',
      'server/tenancy/tenantResolver.ts',
    ]) {
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

  it('mil tenants resolvem para o mesmo conjunto de 10 coleções', () => {
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

    // Era isto que estourava o Atlas: 10 coleções × N tenants. Agora é 10, ponto.
    assert.equal(seen.size, 10);
  });

  it('todo índice de dado de tenant lidera por tenantId', () => {
    const indexes = read('server/db/tenantIndexes.ts');
    const specsStart = indexes.indexOf('function tenantScopedIndexSpecs');
    const specsEnd = indexes.indexOf('export async function ensureSharedCollectionIndexes');
    const specs = indexes.slice(specsStart, specsEnd);

    const keys = [...specs.matchAll(/key:\s*\{\s*([A-Za-z'"][\w'".]*)\s*:/g)].map((m) =>
      m[1].replace(/['"]/g, ''),
    );

    assert.ok(keys.length > 20, `esperava dezenas de índices, achei ${keys.length}`);
    for (const first of keys) {
      assert.equal(
        first,
        'tenantId',
        `índice liderado por "${first}" não usa o prefixo de tenant e varre o pool inteiro`,
      );
    }
  });

  it('nos demais arquivos de índice, todo prefixo fora do padrão é justificado', () => {
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
      'signers.userId': 'signatário pode ser externo ao tenant do documento',
      'signers.emailNormalized': 'idem — busca por e-mail do signatário',
      signerEmailHash: 'idem — histórico do signatário entre tenants',
      // escopo por usuário, que já é mais estreito que o tenant
      userId: 'favoritos e alertas são por usuário, escopo mais estreito que tenant',
      sharedWithUserId: 'concessões recebidas por um usuário',
      sharedByUserId: 'concessões emitidas por um usuário',
    };

    const files = [
      'server/db/documentShareGrantsIndexes.ts',
      'server/db/externalDocumentShareGrantsIndexes.ts',
      'server/db/documentSignatureIndexes.ts',
      'server/db/documentExpiryAlertIndexes.ts',
      'server/db/documentUploadApprovalIndexes.ts',
      'server/db/userDocumentFavoritesIndexes.ts',
    ];

    let total = 0;
    for (const file of files) {
      const keys = [...read(file).matchAll(/key:\s*\{\s*([A-Za-z'"][\w'".]*)\s*:/g)].map((m) =>
        m[1].replace(/['"]/g, ''),
      );
      assert.ok(keys.length > 0, `${file} não declarou índice nenhum — o teste está lendo errado?`);
      total += keys.length;

      for (const first of keys) {
        if (first === 'tenantId') continue;
        assert.ok(
          first in ALLOWED_NON_TENANT_PREFIX,
          `${file}: índice liderado por "${first}" não lidera por tenantId nem consta na lista de ` +
            `exceções justificadas. Ou ponha tenantId na frente, ou acrescente a exceção com o motivo.`,
        );
      }
    }

    assert.ok(total > 20, `esperava dezenas de índices nos seis arquivos, achei ${total}`);
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
    assert.deepEqual(buildDocumentOwnershipFilter(ctx), {
      $or: [{ tenantId: 'company_x' }, { companyId: 'company_x' }],
    });
  });
});
