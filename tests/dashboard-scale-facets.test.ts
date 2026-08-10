import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildAccessibleDocumentQuery } from '../server/services/dashboardOverviewService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

const dashboard = read('server/services/dashboardOverviewService.ts');

describe('dashboard sem varreduras — Passo 5 do plano de escala', () => {
  it('não traz mais documentos do tenant para a memória do Node', () => {
    // As duas varreduras originais: .find(docQuery).project({ processingStatus }) e
    // .project({ classId, className }) — sem limit, N documentos por load do dashboard.
    assert.equal(dashboard.includes('.project({ processingStatus: 1 })'), false);
    assert.equal(dashboard.includes('.project({ classId: 1, className: 1 })'), false);
    assert.equal(
      /\.find\(docQuery\)/.test(dashboard),
      false,
      'nenhuma leitura de documentos do dashboard deve usar find() sobre o tenant inteiro',
    );
  });

  it('agrega status, categoria e as três contagens num único $facet', () => {
    assert.ok(dashboard.includes('aggregateDocumentFacets'));
    assert.ok(dashboard.includes('$facet'));

    for (const branch of [
      'total:',
      'today:',
      'inPeriod:',
      'byStatus:',
      'byCategory:',
      'withoutCategory:',
    ]) {
      assert.ok(dashboard.includes(branch), `ramo ${branch} ausente do $facet`);
    }

    // O agrupamento tem de acontecer no servidor, não no Node.
    assert.ok(dashboard.includes("$group: { _id: '$processingStatus'"));
    assert.ok(dashboard.includes('$sum: 1'));
  });

  it('recorta o top de categorias no servidor', () => {
    assert.ok(dashboard.includes('CATEGORY_FACET_LIMIT'));
    assert.ok(dashboard.includes('$limit: CATEGORY_FACET_LIMIT'));
    assert.ok(dashboard.includes('$sort: { count: -1 }'));
  });

  it('preserva o trim de classId/className ao classificar "sem categoria"', () => {
    assert.ok(dashboard.includes('$trim'));
    assert.ok(dashboard.includes('_classId'));
    assert.ok(dashboard.includes('_className'));
  });

  it('a contagem de auditoria não usa regex case-insensitive', () => {
    // Ignora comentários: só interessa o que vai para a query.
    const code = dashboard
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    assert.equal(
      code.includes("$options: 'i'"),
      false,
      "$options: 'i' anula o índice { tenantId, action, createdAt } mesmo com regex ancorada",
    );
    assert.ok(code.includes("action: { $regex: '^document\\\\.' }"));
  });

  it('action é normalizada em minúsculas na escrita do audit log', () => {
    const auditService = read('server/audit/documentAuditLogService.ts');

    assert.ok(auditService.includes('event.action.trim().toLowerCase()'));
    // O documento persistido usa a versão normalizada, não a crua.
    assert.equal(auditService.includes('action: event.action,'), false);
  });

  it('o índice que a consulta passa a usar existe', () => {
    const indexes = read('server/db/tenantIndexes.ts');

    assert.ok(indexes.includes('{ key: { tenantId: 1, action: 1, createdAt: -1 } }'));
  });
});

describe('dashboard — escopo de tenant na consulta de documentos', () => {
  const businessStorage = {
    tenantId: 'tenant_a',
    tenantType: 'business',
    storageMode: 'shared_collections',
    collectionPrefix: 'tenant_a',
    collections: {},
  } as never;

  const user = { id: 'user_x', name: 'Fulano' } as never;

  it('usuário comum continua filtrado por tenant, não só por ownership', () => {
    const query = buildAccessibleDocumentQuery(businessStorage, user, false, ['cat_1']);

    // O escopo de tenant empresarial é um `$or`; atribuir `query.$or` com as cláusulas de acesso
    // apagava esse escopo. Em coleção compartilhada isso somaria documentos de outros tenants
    // que o usuário possui.
    const and = query.$and as Record<string, unknown>[] | undefined;
    assert.ok(Array.isArray(and), 'as duas condições precisam conviver, não se sobrescrever');

    const serialized = JSON.stringify(and);
    assert.ok(serialized.includes('tenant_a'), 'o filtro de tenant precisa sobreviver');
    assert.ok(serialized.includes('user_x'));
    assert.ok(serialized.includes('cat_1'));

    // Nenhum `$or` solto no topo: seria justamente o que apagou o escopo antes.
    assert.equal(query.$or, undefined);
  });

  it('admin mantém o escopo de tenant sem cláusula de acesso', () => {
    const query = buildAccessibleDocumentQuery(businessStorage, user, true, []);

    assert.equal(query.$and, undefined);
    assert.ok(JSON.stringify(query.$or).includes('tenant_a'));
  });
});
