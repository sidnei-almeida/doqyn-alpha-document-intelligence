import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it } from 'node:test';
import {
  buildMirrorKey,
  checkMirrorEndpoint,
  getStorageMirrorConfig,
  isStorageMirrorEnabled,
} from '../server/storage/mirror/mirrorConfig.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const ENV_KEYS = [
  'STORAGE_MIRROR_ENABLED',
  'STORAGE_MIRROR_ENDPOINT',
  'STORAGE_MIRROR_ACCESS_KEY_ID',
  'STORAGE_MIRROR_SECRET_ACCESS_KEY',
  'STORAGE_MIRROR_KEY_PREFIX',
  'STORAGE_MIRROR_MAX_OBJECT_MB',
] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

const COMPLETO = {
  STORAGE_MIRROR_ENABLED: 'true',
  STORAGE_MIRROR_ENDPOINT: 'http://minio:9000',
  STORAGE_MIRROR_ACCESS_KEY_ID: 'chave',
  STORAGE_MIRROR_SECRET_ACCESS_KEY: 'segredo',
} as const;

afterEach(() => setEnv({}));

describe('o espelho nasce desligado', () => {
  it('sem variável nenhuma, não existe', () => {
    setEnv({});
    assert.equal(getStorageMirrorConfig(), null);
    assert.equal(isStorageMirrorEnabled(), false);
  });

  it('configuração pela metade não liga espelho pela metade', () => {
    /**
     * Endpoint sem credencial enfileiraria job que falha para sempre, e o acervo pareceria
     * espelhado sem estar. Na dúvida, desligado.
     */
    setEnv({ ...COMPLETO, STORAGE_MIRROR_SECRET_ACCESS_KEY: '' });
    assert.equal(getStorageMirrorConfig(), null);

    setEnv({ ...COMPLETO, STORAGE_MIRROR_ENDPOINT: '' });
    assert.equal(getStorageMirrorConfig(), null);
  });

  it('a flag sozinha não basta, e a configuração completa liga', () => {
    setEnv({ STORAGE_MIRROR_ENABLED: 'true' });
    assert.equal(getStorageMirrorConfig(), null);

    setEnv(COMPLETO);
    const config = getStorageMirrorConfig();
    assert.ok(config);
    assert.equal(config!.endpoint, 'http://minio:9000');
  });

  it('desligado explicitamente vence a configuração completa', () => {
    setEnv({ ...COMPLETO, STORAGE_MIRROR_ENABLED: 'false' });
    assert.equal(getStorageMirrorConfig(), null);
  });
});

describe('o endpoint do espelho é checado antes de virar cliente', () => {
  it('aceita https em qualquer host', () => {
    const check = checkMirrorEndpoint('https://s3.us-west-1.backblazeb2.com');
    assert.ok(check.ok);
  });

  it('aceita http só para host interno', () => {
    // Dentro da rede do Compose o tráfego não sai da máquina, e texto claro ali é o normal.
    for (const url of ['http://minio:9000', 'http://127.0.0.1:9000', 'http://192.168.1.10:9000']) {
      assert.ok(checkMirrorEndpoint(url).ok, url);
    }
  });

  it('recusa http para host público', () => {
    // Mandaria credencial e documento em texto claro pela rede aberta.
    const check = checkMirrorEndpoint('http://backup.exemplo.com');
    assert.equal(check.ok, false);
    assert.match(check.ok === false ? check.reason : '', /https/);
  });

  it('recusa credencial embutida na URL', () => {
    // Ela vaza em log de requisição e em mensagem de erro do SDK.
    const check = checkMirrorEndpoint('https://chave:segredo@s3.exemplo.com');
    assert.equal(check.ok, false);
    assert.match(check.ok === false ? check.reason : '', /[Cc]redencial/);
  });

  it('recusa esquema que não é http(s) e URL quebrada', () => {
    assert.equal(checkMirrorEndpoint('file:///etc/passwd').ok, false);
    assert.equal(checkMirrorEndpoint('não é url').ok, false);
  });

  it('endpoint recusado deixa o espelho desligado, mesmo com tudo o mais certo', () => {
    setEnv({ ...COMPLETO, STORAGE_MIRROR_ENDPOINT: 'http://backup.exemplo.com' });
    assert.equal(getStorageMirrorConfig(), null);
  });
});

describe('o espelho copia as regras de endereço do R2', () => {
  it('não existe bucket único do espelho na configuração', () => {
    /**
     * O nome do bucket *é* a fronteira de isolamento: PJ ganha o seu, PF divide o compartilhado
     * sob prefixo opaco. Um bucket único achataria tudo numa pilha só — a chave ainda carregaria o
     * tenant, mas a fronteira que permite política e credencial por tenant sumiria.
     */
    const config = read('server/storage/mirror/mirrorConfig.ts');
    assert.ok(!/STORAGE_MIRROR_BUCKET\b/.test(config), 'bucket único não pode voltar');
    assert.ok(!/\bbucket: string;/.test(config.slice(0, config.indexOf('const DEFAULT'))));
  });

  it('a escrita recebe o bucket de quem chamou, e a leitura também', () => {
    const storage = read('server/storage/mirror/mirrorStorage.ts');
    assert.match(storage, /Bucket: input\.bucket/);
    assert.match(storage, /readMirroredObject\(\s*bucket: string,/);
  });

  it('o job de espelho usa o bucket que a promoção resolveu', () => {
    const worker = read('server/workers/storagePromotionWorker.ts');
    assert.match(worker, /bucket: payload\.bucket/);
  });
});

describe('o bucket do espelho nasce configurado como o do R2', () => {
  it('reusa as mesmas funções de criação e de CORS', () => {
    // Duplicar a regra criaria dois lugares para a política mudar, e um ficaria para trás.
    const buckets = read('server/storage/mirror/mirrorBuckets.ts');
    assert.match(buckets, /from '\.\.\/r2\/r2BucketProvisioner\.js'/);
    assert.match(buckets, /ensureBucketCors/);
    assert.match(buckets, /createTenantBucket/);
  });

  it('não confia no cache de CORS do R2, que é indexado só pelo nome', () => {
    /**
     * O nome do bucket no espelho é o mesmo do R2 de propósito. Sem memo próprio, verificar o
     * bucket do original marcaria o do espelho como pronto — e ele passaria a vida sem CORS e
     * talvez sem existir.
     */
    const buckets = read('server/storage/mirror/mirrorBuckets.ts');
    assert.match(buckets, /ensuredMirrorBuckets/);
    assert.match(buckets, /ensureBucketCors\(client, bucket, \{ force: true \}\)/);
  });

  it('a escrita garante o bucket antes de gravar, e a leitura não provisiona', () => {
    const storage = read('server/storage/mirror/mirrorStorage.ts');
    const escrita = storage.indexOf('export async function mirrorObject');
    const leitura = storage.indexOf('export async function readMirroredObject');
    const ensure = storage.indexOf('await ensureMirrorBucket(');
    assert.ok(ensure > escrita && ensure < leitura, 'ensure tem de ficar na escrita');
    // Criar bucket vazio na leitura esconderia a ausência de cópia atrás de "não encontrado".
    // A menção em comentário ali é explicação, não chamada — por isso a busca é pela chamada.
    assert.ok(!storage.slice(leitura).includes('await ensureMirrorBucket('));
  });
});

describe('a chave no espelho é a mesma do R2', () => {
  it('sem prefixo, a chave não muda', () => {
    setEnv(COMPLETO);
    const config = getStorageMirrorConfig()!;
    assert.equal(
      buildMirrorKey(config, 'documents/t_acme/doc_1/v_1.pdf'),
      'documents/t_acme/doc_1/v_1.pdf',
    );
  });

  it('com prefixo, ele entra na frente sem duplicar barra', () => {
    setEnv({ ...COMPLETO, STORAGE_MIRROR_KEY_PREFIX: '/acervo/' });
    const config = getStorageMirrorConfig()!;
    assert.equal(
      buildMirrorKey(config, '/documents/t_acme/doc_1.pdf'),
      'acervo/documents/t_acme/doc_1.pdf',
    );
  });
});

describe('o MinIO do Compose não se expõe', () => {
  const compose = read('deploy/docker-compose.production.yml');

  it('fica atrás de profile e sem porta publicada', () => {
    // Publicar a 9000 exporia o acervo inteiro atrás de uma senha de variável de ambiente.
    const bloco = compose.slice(compose.indexOf('  minio:'), compose.indexOf('  doqyn-api:'));
    assert.match(bloco, /profiles: \["mirror"\]/);
    assert.ok(!/\n\s+ports:/.test(bloco), 'o serviço minio não pode publicar porta');
    assert.match(bloco, /MINIO_BROWSER: \$\{MINIO_BROWSER:-off\}/);
  });

  it('a checagem de credencial não pode usar `${VAR:?}` no environment', () => {
    /**
     * O Compose interpola TODOS os serviços, inclusive os que estão atrás de profile. Com `:?` ali,
     * qualquer deploy normal quebrava por causa de um serviço que nem ia subir — e isso derrubaria
     * a produção no primeiro deploy depois deste commit.
     */
    const bloco = compose.slice(compose.indexOf('  minio:'), compose.indexOf('  doqyn-api:'));
    assert.ok(
      !/MINIO_ROOT_(USER|PASSWORD): \$\{[A-Z_]+:\?/.test(bloco),
      '`:?` no environment do minio quebra o deploy sem o profile',
    );
    // A checagem existe, só que no command: ela dispara quando o MinIO de fato inicia.
    assert.match(bloco, /if \[ -z "\$\$MINIO_ROOT_USER" \]/);
    // Sem isso o MinIO cairia no par padrão `minioadmin:minioadmin`, que é senha pública.
    assert.match(bloco, /MINIO_ROOT_PASSWORD: \$\{STORAGE_MIRROR_SECRET_ACCESS_KEY:-\}/);
  });
});

describe('ligar o espelho na VPS não depende de lembrar o profile na mão', () => {
  it('o .env.example traz o bloco, desligado, e sem bucket único', () => {
    const example = read('.env.example');
    assert.match(example, /^STORAGE_MIRROR_ENABLED=false$/m);
    assert.match(example, /^STORAGE_MIRROR_ENDPOINT=http:\/\/minio:9000$/m);
    assert.match(example, /^STORAGE_MIRROR_ACCESS_KEY_ID=$/m);
    assert.match(example, /^STORAGE_MIRROR_SECRET_ACCESS_KEY=$/m);
    assert.ok(!/STORAGE_MIRROR_BUCKET\b/.test(example), 'bucket único não pode voltar');
  });

  it('o wrapper do Compose só passa --profile mirror quando a flag está ligada', () => {
    const wrapper = read('deploy/scripts/lib/compose-production.sh');
    assert.match(wrapper, /compose_append_mirror_profile/);
    assert.match(wrapper, /storage_mirror_profile_enabled/);
    assert.match(wrapper, /__compose_cmd\+=\(--profile mirror\)/);
  });

  it('o setup grava o espelho desligado, com credencial já gerada', () => {
    const setup = read('deploy/scripts/setup-production-env.sh');
    assert.match(setup, /STORAGE_MIRROR_ENABLED=false/);
    assert.match(setup, /openssl rand -hex 24/);
    assert.match(setup, /STORAGE_MIRROR_ACCESS_KEY_ID=\$\{STORAGE_MIRROR_ACCESS_KEY_ID\}/);
  });

  it('o validador da VPS só cobra credencial do espelho quando a flag está ligada', () => {
    const validate = read('deploy/scripts/validate-vps-ready.sh');
    const r2 = validate.indexOf('require_var R2_SECRET_ACCESS_KEY');
    const mirror = validate.indexOf('require_var STORAGE_MIRROR_SECRET_ACCESS_KEY');
    const flag = validate.indexOf('STORAGE_MIRROR_ENABLED');
    assert.ok(r2 > 0 && mirror > r2, 'a cobrança do espelho tem de vir depois do R2');
    assert.ok(flag > 0 && flag < mirror, 'a cobrança tem de ficar atrás da flag');
  });
});

describe('o espelho entra depois da promoção, e a leitura cai nele por último', () => {
  it('o job de espelho é enfileirado só quando a versão já está no endereço definitivo', () => {
    const worker = read('server/workers/storagePromotionWorker.ts');
    const trocaDeEndereco = worker.indexOf("'storage.primary.objectKey': payload.destinationKey");
    // `indexOf` da chamada, não do import — o import vem no topo e passaria em qualquer ordem.
    const espelho = worker.indexOf('await enqueueStorageMirrorJob(payload)');
    const promocao = worker.indexOf("return 'promoted'");

    assert.ok(trocaDeEndereco > 0 && espelho > 0 && promocao > 0, 'âncoras sumiram do worker');
    // Antes da troca de endereço não há o que copiar: o arquivo ainda é provisório.
    assert.ok(trocaDeEndereco < espelho, 'o espelho não pode preceder a troca de endereço');
    assert.ok(espelho < promocao, 'o espelho tem de entrar antes do retorno');
  });

  it('falha ao enfileirar o espelho não derruba a promoção', () => {
    const worker = read('server/workers/storagePromotionWorker.ts');
    assert.match(worker, /enqueueStorageMirrorJob\(payload\)\.catch/);
  });

  it('preview e miniatura também vão para o espelho', () => {
    const provider = read('server/storage/r2/r2StorageProvider.ts');
    // Preview é dado derivado: se o espelho perder um, ele se refaz do original. Por isso a
    // gravação é best-effort e não derruba a geração que o usuário está esperando na tela.
    assert.match(provider, /await this\.mirrorDerived\(\s*bucket,\s*storageKey,/);
    assert.match(provider, /await this\.mirrorDerived\(\s*bucket,\s*input\.objectKey,/);
    assert.match(provider, /mirrorObject\(\{[\s\S]*?\}\)\.catch/);
  });

  it('a leitura de preview herda o mesmo fallback da versão', () => {
    const provider = read('server/storage/r2/r2StorageProvider.ts');
    // `readDocumentPreview` delega para `readDocumentVersion`, então o fallback vale para os dois
    // sem código repetido — e sem um segundo caminho de leitura para esquecer de proteger.
    assert.match(provider, /async readDocumentPreview\([\s\S]*?return this\.readDocumentVersion\(/);
  });

  it('o fallback de leitura mora dentro do provedor, onde a autorização já aconteceu', () => {
    const provider = read('server/storage/r2/r2StorageProvider.ts');
    assert.match(provider, /readMirroredObject/);
    // Sem objeto no espelho, o erro original sobe: falha de storage não pode virar "não existe".
    assert.match(provider, /if \(!mirrored\) throw error;/);
  });
});
