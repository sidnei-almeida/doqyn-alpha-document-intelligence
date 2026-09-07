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

/**
 * Índice cuja forma mudou mas o nome ficou.
 *
 * O Mongo recusa reaproveitar um nome com chave diferente, e a checagem por forma de chave nunca
 * encontra o índice novo — sem derrubar o antigo, toda rodada do job repete o mesmo erro e o
 * índice novo nunca nasce. Aconteceu com `inbound_pending_by_recipient`, que ficou meses no banco
 * com uma chave começando por `inbound.recipientTenantId`, campo que só existe **depois** de
 * aceito e portanto nunca está presente nos pendentes que o índice deveria servir.
 */
describe('índice renomeado é reconciliado, não repetido como erro', () => {
  it('derruba o nome ocupado quando a chave difere', () => {
    const fonte = read('server/db/tenantIndexes.ts');
    assert.ok(fonte.includes('idx.name === spec.name'));
    assert.ok(fonte.includes('dropIndex(spec.name)'));
    // Nunca o índice do _id: derrubá-lo não é reconciliar, é quebrar a coleção.
    assert.ok(fonte.includes("spec.name !== '_id_'"));
    // A guarda de desigualdade impede soltar e recriar a cada rodada, deixando a coleção sem
    // índice durante a reconstrução por nada.
    assert.ok(fonte.includes('JSON.stringify(sameName.key) !== keyStr'));
  });

  it('há uma implementação só, e o job de operação a usa', () => {
    // A duplicata custou dois defeitos idênticos: o TTL descartado e o nome ocupado que nunca
    // era derrubado — cada um teve de ser corrigido nos dois lugares.
    const script = read('scripts/ensure-mongodb-indexes.ts');
    assert.ok(script.includes('ensureIndexesForCollection'));
    assert.equal(script.includes('async function ensureCollectionExists'), false);
    assert.equal(script.includes('collection.createIndex'), false);
  });

  it('as specs do registro moram num lugar só', () => {
    const servidor = read('server/db/tenantIndexes.ts');
    const script = read('scripts/ensure-mongodb-indexes.ts');
    assert.ok(servidor.includes('export const REGISTRY_INDEX_SPECS'));
    assert.ok(script.includes('ensureRegistryTenantIndexes'));
    // As duas listas divergiram uma vez: o script criava índices em `tenant_members` que o
    // provisionamento nunca criava.
    assert.equal(script.includes('REGISTRY_COLLECTIONS.tenantMembers'), false);
  });

  it('a caixa de entrada é indexada pelo destinatário, não pelo tenant que só existe depois', () => {
    const fonte = read('server/db/documentShareGrantsIndexes.ts');
    const bloco = fonte.slice(fonte.indexOf('inbound_pending_by_recipient') - 400);
    assert.ok(bloco.includes("partialFilterExpression: { 'inbound.status': 'pending' }"));
    assert.ok(!bloco.includes('inbound.recipientTenantId'));
  });
});
