import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  findAuditActionsMatching,
  normalizeServerLocale,
  renderAuditText,
} from '../server/i18n/index.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('frases de auditoria no servidor', () => {
  it('sai no idioma pedido, com valores e variante', () => {
    assert.equal(
      renderAuditText('pt-BR', 'document.moved', 'description', { categoryName: 'Contratos' }),
      'Documento movido para Contratos.',
    );
    assert.equal(
      renderAuditText('en-US', 'document.moved', 'description', { categoryName: 'Contracts' }),
      'Document moved to Contracts.',
    );
    assert.equal(
      renderAuditText('es-419', 'document.moved', 'description', {
        context: 'batch',
        categoryName: 'Contratos',
      }),
      'Documento movido a Contratos (lote).',
    );
    assert.equal(renderAuditText('en', 'document.downloaded', 'label'), 'Downloaded');
  });

  it('variante que não existe cai na frase padrão da ação', () => {
    assert.equal(
      renderAuditText('pt-BR', 'document.trash_moved', 'description', { context: 'inexistente' }),
      'Documento movido para a lixeira.',
    );
  });

  it('ação fora do catálogo devolve undefined, para quem grava decidir o que fazer', () => {
    assert.equal(renderAuditText('pt-BR', 'document.nao_existe', 'description'), undefined);
  });

  it('idioma desconhecido cai no pt-BR; variante regional cai na família', () => {
    assert.equal(normalizeServerLocale('fr-FR'), 'pt-BR');
    assert.equal(normalizeServerLocale(undefined), 'pt-BR');
    assert.equal(normalizeServerLocale('es-MX'), 'es-419');
    assert.equal(normalizeServerLocale('en_GB'), 'en-US');
  });

  it('a busca acha a ação pelo texto de qualquer idioma, com ou sem acento', () => {
    for (const term of ['lixeira', 'papelera', 'trash']) {
      assert.ok(findAuditActionsMatching(term).includes('document.trash_moved'), term);
    }
    assert.ok(findAuditActionsMatching('analise').includes('document.analysis_started'));
    assert.ok(findAuditActionsMatching('Análisis').includes('document.analysis_started'));
    // Termo curto demais casaria com quase tudo.
    assert.deepEqual(findAuditActionsMatching('ab'), []);
  });
});

describe('gravação de evento pelo catálogo', () => {
  it('evento sem frase pronta grava params e a frase no idioma do ator', () => {
    const service = read('server/audit/documentAuditLogService.ts');
    assert.ok(service.includes('const fromCatalog = event.description === undefined'));
    assert.ok(service.includes("renderAuditText(ctx.actorLocale, action, 'description', params)"));
    assert.ok(service.includes('...(params ? { params } : {})'));
    // A cadeia assina a frase efetivamente gravada.
    assert.match(service, /reserveChainSlot\(ctx\.tenantId, \{\s*id,\s*action,\s*description,/);
  });

  it('o contexto de auditoria leva o idioma de quem age', () => {
    const builder = read('server/audit/buildDocumentAuditContext.ts');
    assert.ok(builder.includes('actorLocale: user.locale ?? user.tenantDefaultLocale'));
  });

  it('nenhuma chamada da API grava frase de auditoria em português à mão', () => {
    const offenders = [
      'api/documents/[documentId]/move.ts',
      'api/documents/batch/move.ts',
      'api/documents/[documentId]/transfer-ownership.ts',
      'api/inbound-shares/[grantId]/decide.ts',
      'api/approval-requests/[requestId]/decide.ts',
      'server/services/confirmAnalysisService.ts',
      'server/services/confirmUpdateDocumentVersionService.ts',
      'server/services/tracking/trackingService.ts',
    ].filter((file) => /\n\s*description: ['`]/.test(read(file)));
    assert.deepEqual(offenders, []);
  });
});
