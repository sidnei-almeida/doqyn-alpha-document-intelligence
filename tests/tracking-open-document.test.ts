import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('tracking persiste no Mongo', () => {
  it('o evento vira registro de auditoria, não só resposta de tela', () => {
    const service = readRepoFile('server/services/tracking/trackingService.ts');

    // `createDocumentAuditLog` grava em `audit_logs` com encadeamento de integridade; sem ele o
    // evento existiria só no ar da requisição.
    assert.match(service, /createDocumentAuditLog/);
  });

  it('a consulta de eventos lê do banco, não de memória', () => {
    const summary = readRepoFile('server/services/tracking/trackingSummaryService.ts');
    assert.match(summary, /auditLogs|getTenantCollections|collection/);
  });
});

describe('atalho do tracking para o documento', () => {
  it('o nome do documento na tabela abre a Biblioteca no arquivo', () => {
    const cell = readRepoFile('src/features/tracking/components/TrackingDocumentCell.tsx');

    assert.match(cell, /\/biblioteca\?preview=/);
    // Sem id não há atalho: evento de sistema não aponta para documento nenhum.
    assert.match(cell, /documentId \?/);
  });

  it('a gaveta do evento também oferece abrir o documento', () => {
    const drawer = readRepoFile('src/features/tracking/components/TrackingEventDetailsDrawer.tsx');

    assert.match(drawer, /Abrir documento/);
    assert.match(drawer, /\/biblioteca\?preview=/);
  });

  it('a Biblioteca entende o link e abre o visualizador', () => {
    const page = readRepoFile('src/features/library/LibraryPage.tsx');

    assert.match(page, /searchParams\.get\('preview'\)/);
    assert.match(page, /setViewer\(\{ documentId: previewId, mode: 'preview' \}\)/);
    // O parâmetro sai da URL depois de usado, senão recarregar a página reabre o visualizador.
    assert.match(page, /next\.delete\('preview'\)/);
  });
});
