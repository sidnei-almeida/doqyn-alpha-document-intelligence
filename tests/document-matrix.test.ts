import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ORIGIN_PRIORITY,
  primaryOrigin,
} from '../src/features/matrix/components/accessOrigin';

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('origem do acesso na matriz', () => {
  it('a origem mais forte manda na célula', () => {
    assert.equal(primaryOrigin(['share', 'owner']), 'owner');
    assert.equal(primaryOrigin(['governance', 'admin']), 'admin');
    assert.equal(primaryOrigin(['share', 'governance']), 'governance');
    assert.equal(primaryOrigin(['share']), 'share');
  });

  it('sem origem, não há acesso', () => {
    assert.equal(primaryOrigin([]), null);
  });

  it('a ordem de prioridade cobre todas as origens', () => {
    // Origem nova sem lugar na prioridade sumiria da célula sem ninguém notar.
    assert.deepEqual(ORIGIN_PRIORITY, ['owner', 'admin', 'governance', 'share']);
  });
});

describe('matriz de acesso — contrato do serviço', () => {
  const service = readRepoFile('server/services/matrix/documentAccessMatrixService.ts');

  it('herda o escopo da Biblioteca em vez de consultar documentos por fora', () => {
    // Consultar a coleção direto aqui seria abrir um caminho paralelo ao filtro de tenant.
    assert.match(service, /listDocuments\(\{/);
    assert.equal(service.includes("db.collection('documents')"), false);
  });

  it('resolve compartilhamentos e grupos em lote, não por documento', () => {
    assert.match(service, /documentId: \{ \$in: documentIds \}/);
    assert.match(service, /Promise\.all\(\[/);
  });

  it('a célula carrega a origem e o grupo que a sustenta', () => {
    assert.match(service, /origins: DocumentAccessOrigin\[\]/);
    assert.match(service, /viaGroupIds: string\[\]/);
    // Sem o id do grant não há como revogar da própria matriz.
    assert.match(service, /shareGrantId\?: string/);
  });

  it('só quem tem acesso vira célula', () => {
    assert.match(service, /if \(origins\.length === 0\) continue;/);
  });
});

describe('registro das rotas da matriz', () => {
  it('a rota da matriz está no dispatcher', () => {
    const server = readRepoFile('server/apiServer.ts');

    // Arquivo em api/ não vira rota sozinho fora da Vercel.
    assert.match(server, /'\/api\/documents\/matrix\/access'/);
  });

  it('a seção está no menu e na rota do app', () => {
    assert.match(readRepoFile('src/lib/constants.ts'), /path: '\/matriz'/);
    assert.match(readRepoFile('src/app/routes.tsx'), /path: '\/matriz'/);
  });
});

describe('metadados saíram da matriz e viraram ficha do documento', () => {
  it('cada tipo de documento tem campos próprios: a ficha é por documento', () => {
    const drawer = readRepoFile('src/features/library/components/DocumentMetadataDrawer.tsx');
    const menu = readRepoFile('src/features/library/components/ExplorerContextMenu.tsx');
    const details = readRepoFile('src/features/library/components/OptionalDetailsDrawer.tsx');

    assert.match(drawer, /DocumentExpiryEditor/);
    // Dois caminhos, porque são dois momentos: o menu do arquivo e o painel de detalhes aberto.
    assert.match(menu, /label="Metadados"/);
    assert.match(details, /Editar metadados/);
  });

  it('o botão da ficha só aparece para quem pode editar', () => {
    const details = readRepoFile('src/features/library/components/OptionalDetailsDrawer.tsx');
    assert.match(details, /doc\.permissions\?\.canEditMetadata/);
  });

  it('a matriz passa a falar só de permissão', () => {
    const page = readRepoFile('src/features/matrix/MatrixPage.tsx');

    assert.match(page, /'people' \| 'groups'/);
    assert.equal(page.includes('MetadataMatrixTable'), false);
  });

  it('a leitura por grupo mostra o verbo, não só o acesso', () => {
    const service = readRepoFile('server/services/matrix/documentAccessMatrixService.ts');

    assert.match(service, /canUpdate: boolean/);
    assert.match(service, /canAudit: boolean/);
    assert.match(service, /updateByCategory/);
  });

  it('o item da lista é tipado, não adivinhado', () => {
    const service = readRepoFile('server/services/matrix/documentAccessMatrixService.ts');

    // Ler o resultado como `Record<string, unknown>` foi o que deixou passar `classId` e
    // `className` — nomes que a listagem não publica. Com o tipo, nome errado não compila.
    assert.match(service, /type ListedDocument = Awaited<ReturnType<typeof listDocuments>>/);
    assert.match(service, /const documents: ListedDocument\[\]/);
    assert.equal(service.includes('doc.classId'), false);
    assert.equal(service.includes('doc.className'), false);
  });
});
