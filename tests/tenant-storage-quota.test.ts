import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  assertTenantStorageAvailable,
  readStorageQuotaBytes,
} from '../server/services/tenantStorageQuotaService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

const GB = 1024 * 1024 * 1024;

function withQuota<T>(raw: string | undefined, run: () => T): T {
  const previous = process.env.TENANT_STORAGE_QUOTA_BYTES;
  if (raw === undefined) delete process.env.TENANT_STORAGE_QUOTA_BYTES;
  else process.env.TENANT_STORAGE_QUOTA_BYTES = raw;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TENANT_STORAGE_QUOTA_BYTES;
    else process.env.TENANT_STORAGE_QUOTA_BYTES = previous;
  }
}

describe('cota de armazenamento — leitura do teto', () => {
  it('sem variável, o padrão é 10 GB', () => {
    assert.equal(
      withQuota(undefined, () => readStorageQuotaBytes()),
      10 * GB,
    );
  });

  it('valor explícito vence o padrão', () => {
    assert.equal(
      withQuota(String(2 * GB), () => readStorageQuotaBytes()),
      2 * GB,
    );
  });

  it('zero, negativo ou lixo desliga a cota em vez de inventar um teto', () => {
    for (const raw of ['0', '-1', 'ilimitado', '']) {
      const value = withQuota(raw, () => readStorageQuotaBytes());
      // String vazia cai no padrão (`?.trim()` devolve ''), o resto desliga.
      assert.ok(value === null || value === 10 * GB, `"${raw}" não deveria virar teto arbitrário`);
    }
    assert.equal(
      withQuota('ilimitado', () => readStorageQuotaBytes()),
      null,
    );
  });
});

describe('cota de armazenamento — o portão', () => {
  it('sem cota configurada, não consulta o banco nem recusa', async () => {
    const decision = await withQuota('0', () =>
      assertTenantStorageAvailable({ tenantId: 'tenant_a', incomingBytes: 500 * GB }),
    );
    assert.equal(decision.quotaBytes, null);
  });

  it('nova versão passa mesmo com o acervo no teto', async () => {
    // O caminho de versão nem lê o contador: trocar um contrato pela versão corrigida não faz o
    // acervo crescer, e travar isso prenderia a pessoa no documento errado.
    const decision = await withQuota(String(1), () =>
      assertTenantStorageAvailable({
        tenantId: 'tenant_a',
        incomingBytes: 500 * GB,
        isNewVersion: true,
      }),
    );
    assert.equal(decision.incomingBytes, 500 * GB);
  });

  it('tamanho inválido não vira crédito negativo', async () => {
    const decision = await withQuota('0', () =>
      assertTenantStorageAvailable({ tenantId: 'tenant_a', incomingBytes: Number.NaN }),
    );
    assert.equal(decision.incomingBytes, 0);
  });
});

describe('cota de armazenamento — onde está ligada', () => {
  it('o portão roda no presign, antes de o arquivo existir', () => {
    const handler = read('api/documents/upload-url.ts');
    assert.ok(handler.includes('assertTenantStorageAvailable'));
    // Depois do ritmo, antes de emitir a URL: recusar após o upload deixaria o arquivo no R2 e no
    // provisório `tmp/`, com dois caminhos de limpeza para falhar em silêncio.
    assert.ok(
      handler.indexOf('assertTenantStorageAvailable') <
        handler.indexOf('issueAnalysisStagingUploadUrl({'),
    );
    // O presign precisa saber se é versão; sem isso o portão barraria troca de versão também.
    assert.ok(handler.includes('isNewVersion'));
  });

  it('o front declara o documentId no presign, não só na análise', () => {
    const client = read('src/features/document-send/services/analyzePdf.ts');
    assert.ok(
      client.includes('requestStagingUploadUrl(file, options?.signal, options?.documentId)'),
    );
  });

  it('as duas confirmações somam ao contador só quando o original ficou guardado', () => {
    for (const path of [
      'server/services/confirmAnalysisService.ts',
      'server/services/confirmUpdateDocumentVersionService.ts',
    ]) {
      const service = read(path);
      assert.ok(service.includes('addTenantStoredBytes'), `${path} não soma ao contador`);
      const call = service.indexOf('addTenantStoredBytes(tenantId');
      const guard = service.lastIndexOf("versionStorage.primary.status === 'stored'", call);
      assert.ok(guard > 0 && call - guard < 400, `${path} soma sem conferir se guardou`);
    }
  });

  it('o contador fica em usage, separado do registro do bucket', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoTenantUsage'));
    assert.ok(types.includes('usage?: MongoTenantUsage'));
    // `storage` descreve o bucket; misturar consumo ali confundiria as duas coisas.
    assert.ok(types.includes('storage?: MongoTenantStorage'));
  });

  it('o teto tem um dono só: o serviço da cota', () => {
    const usage = read('server/services/tenantUsageService.ts');
    assert.ok(usage.includes("readStorageQuotaBytes } from './tenantStorageQuotaService.js'"));
    assert.equal(usage.includes('const DEFAULT_STORAGE_QUOTA_BYTES'), false);
  });

  it('a reconciliação existe e não grava sem --apply', () => {
    const script = read('scripts/reconcile-tenant-storage.ts');
    assert.ok(script.includes("includes('--apply')"));
    assert.ok(script.includes('setTenantStoredBytes'));
    assert.ok(script.includes('sumTenantStoredBytes'));
    // Fecha Mongo E Redis: resolver o tenant abre um socket de cache que segura o processo de pé
    // depois do relatório pronto — foi o que fez a primeira execução em produção pendurar.
    assert.ok(script.includes('closeMongoConnection()'));
    assert.ok(script.includes('closeRedis()'));
    assert.ok(read('package.json').includes('storage:reconcile'));
    // `tsx` é devDependency e a imagem de produção instala com `--omit=dev`: script que não entra
    // no bundle não tem como rodar na VPS, que é justamente onde a reconciliação importa.
    assert.ok(read('scripts/build-server.mjs').includes('scripts/reconcile-tenant-storage.ts'));

    // E estar na lista do build não basta: a imagem precisa ter o arquivo para compilar. Os dois
    // Dockerfiles copiavam `scripts/` arquivo por arquivo, e a lista deles não batia com a do
    // build — `enable-expiry-alerts-defaults.ts` ficou de fora da imagem por isso.
    for (const dockerfile of ['docker/Dockerfile.api', 'docker/Dockerfile.worker']) {
      const content = read(dockerfile);
      assert.ok(
        /^COPY scripts \.\/scripts$/m.test(content),
        `${dockerfile} deve copiar scripts/ inteiro, senão a lista do build silencia o que falta`,
      );
    }
  });

  it('todo script na lista do build existe no repo', () => {
    // O build não reclama de arquivo ausente: ele não acha e segue. Então a guarda é aqui.
    const build = read('scripts/build-server.mjs');
    const block = build.slice(
      build.indexOf('const SCRIPT_ROOTS'),
      build.indexOf('];', build.indexOf('const SCRIPT_ROOTS')),
    );
    const entries = [...block.matchAll(/'(scripts\/[^']+)'/g)].map((match) => match[1]);
    assert.ok(entries.length >= 3, 'a lista do build deveria ter entradas');
    for (const entry of entries) {
      // Entradas podem ser arquivo ou pasta (`scripts/lib`), então a checagem é de existência.
      assert.ok(existsSync(join(repoRoot, entry)), `${entry} está na lista do build e não existe`);
    }
  });
});

describe('cota de armazenamento — a soma é do espaço, não de um usuário', () => {
  it('recorta por tenantId cru, nunca pelo filtro de propriedade', () => {
    const service = read('server/services/tenantStorageQuotaService.ts');
    const block = service.slice(
      service.indexOf('export async function sumTenantStoredBytes'),
      service.indexOf('export async function addTenantStoredBytes'),
    );

    // `tenantScopeFilterFromContext` é filtro de propriedade: em tenant PF ele exige `ownerUserId`
    // e estoura `OWNER_USER_REQUIRED`. Foi assim que a reconciliação morreu no primeiro PF em
    // produção, e é o que o portão devolveria a um PF no teto — 400 confuso em vez de recusa.
    assert.equal(block.includes('tenantScopeFilterFromContext'), false);
    assert.ok(block.includes('$match: { tenantId }'));
    assert.equal(service.includes("from '../tenancy/tenantQuery.js'"), false);
  });
});

describe('cota de armazenamento — o erro que chega na tela', () => {
  it('é ServiceError 413 com código próprio', () => {
    const service = read('server/services/tenantStorageQuotaService.ts');
    assert.ok(service.includes('TENANT_STORAGE_QUOTA_EXCEEDED'));
    assert.ok(service.includes('413'));
    // 413 e não 403: é volume, não permissão — e o front já traduz erro por código.
    assert.equal(service.includes("'TENANT_QUOTA_EXCEEDED'"), false);
  });

  it('somar ao contador nunca derruba uma confirmação que deu certo', () => {
    const service = read('server/services/tenantStorageQuotaService.ts');
    const block = service.slice(
      service.indexOf('export async function addTenantStoredBytes'),
      service.indexOf('export type TenantStorageDecision'),
    );
    assert.ok(block.includes('catch'));
    assert.equal(block.includes('throw'), false);
  });
});
