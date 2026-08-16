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

describe('matriz de metadados — contrato do serviço', () => {
  const service = readRepoFile('server/services/matrix/documentMetadataMatrixService.ts');

  it('as colunas saem da regra da categoria', () => {
    assert.match(service, /getMongoClassAndRule\(\{/);
    assert.match(service, /classAndRule\?\.rule\.fields/);
  });

  it('carrega as versões da página numa consulta só', () => {
    assert.match(service, /_id: \{ \$in: versionIds \}/);
  });

  it('marca o que falta nos campos obrigatórios', () => {
    assert.match(service, /missingRequired\.push\(column\.key\)/);
  });
});

describe('registro das rotas da matriz', () => {
  it('as duas rotas estão no dispatcher', () => {
    const server = readRepoFile('server/apiServer.ts');

    // Arquivo em api/ não vira rota sozinho fora da Vercel.
    assert.match(server, /'\/api\/documents\/matrix\/access'/);
    assert.match(server, /'\/api\/documents\/matrix\/metadata'/);
  });

  it('a seção está no menu e na rota do app', () => {
    assert.match(readRepoFile('src/lib/constants.ts'), /path: '\/matriz'/);
    assert.match(readRepoFile('src/app/routes.tsx'), /path: '\/matriz'/);
  });
});
