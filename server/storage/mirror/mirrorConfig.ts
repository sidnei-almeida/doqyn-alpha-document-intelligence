/**
 * Espelho do acervo num segundo storage compatível com S3.
 *
 * Existe para responder a uma pergunta só: se o R2 sair do ar, o documento ainda abre? A cópia
 * mora onde o operador mandar — MinIO na própria VPS, Backblaze, Wasabi —, porque o que muda entre
 * eles é endpoint e credencial, não o código.
 *
 * Nasce desligado, como o OCR do Vision e a fila do Redis. Sem `STORAGE_MIRROR_ENABLED=true` e sem
 * credencial, nenhum job é enfileirado e nenhum byte é copiado: o custo em produção é zero até
 * alguém decidir ligá-lo.
 *
 * **Isto é fallback de disponibilidade, não backup.** Espelho na mesma máquina que roda a
 * aplicação protege contra o R2 cair; não protege contra perder a máquina. Quem quiser a segunda
 * garantia aponta `STORAGE_MIRROR_ENDPOINT` para outro provedor, que é o mesmo caminho de código.
 */
import { logger } from '../../utils/logger.js';

export type StorageMirrorConfig = {
  endpoint: string;
  region: string;
  /** Prefixo opcional dentro do bucket. A chave do objeto já carrega o escopo do tenant. */
  keyPrefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO só serve em path-style; provedor de nuvem costuma aceitar os dois. */
  forcePathStyle: boolean;
  /** Acima disto o arquivo não é espelhado. Protege o disco de quem hospeda o espelho. */
  maxObjectBytes: number;
  requestTimeoutMs: number;
};

const DEFAULT_MAX_OBJECT_MB = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

function readTrimmed(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = readTrimmed(name).toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number(readTrimmed(name));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Endereços que só existem dentro da máquina ou da rede do Docker.
 *
 * O endpoint vem do `.env`, então quem o define é o operador, não quem usa o produto — isto não é
 * defesa contra SSRF de usuário. O que ele faz é decidir quando aceitar `http://` sem TLS: dentro
 * da rede do Compose (`http://minio:9000`) o tráfego não sai da máquina e texto claro é o normal;
 * apontar para um host público em `http://` mandaria credencial e documento pela rede aberta, e
 * isso é recusado.
 */
const INTERNAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|[a-z0-9_-]+)$/i;

export type MirrorEndpointCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Exportada para o teste cobrir a recusa sem subir cliente nenhum. */
export function checkMirrorEndpoint(raw: string): MirrorEndpointCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'STORAGE_MIRROR_ENDPOINT não é uma URL válida.' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: `esquema não suportado: ${url.protocol}` };
  }

  if (url.username || url.password) {
    // Credencial na URL vaza em log de requisição e em mensagem de erro do SDK.
    return { ok: false, reason: 'credencial embutida na URL do espelho' };
  }

  if (url.protocol === 'http:' && !INTERNAL_HOST.test(url.hostname)) {
    return {
      ok: false,
      reason: `http:// só é aceito para host interno; ${url.hostname} exige https`,
    };
  }

  return { ok: true, url };
}

/**
 * Devolve `null` quando o espelho está desligado ou incompleto — e isso não é erro.
 *
 * Configuração pela metade não pode virar espelho pela metade: um endpoint sem credencial
 * enfileiraria jobs que falham para sempre, e o acervo pareceria espelhado sem estar. Na dúvida,
 * desligado e com um aviso no log.
 */
export function getStorageMirrorConfig(): StorageMirrorConfig | null {
  if (!readBooleanEnv('STORAGE_MIRROR_ENABLED', false)) return null;

  const endpoint = readTrimmed('STORAGE_MIRROR_ENDPOINT');
  const accessKeyId = readTrimmed('STORAGE_MIRROR_ACCESS_KEY_ID');
  const secretAccessKey = readTrimmed('STORAGE_MIRROR_SECRET_ACCESS_KEY');

  const missing = [
    !endpoint && 'STORAGE_MIRROR_ENDPOINT',
    !accessKeyId && 'STORAGE_MIRROR_ACCESS_KEY_ID',
    !secretAccessKey && 'STORAGE_MIRROR_SECRET_ACCESS_KEY',
  ].filter((entry): entry is string => Boolean(entry));

  if (missing.length > 0) {
    logger.warn('espelho de storage ligado mas incompleto — seguindo desligado', { missing });
    return null;
  }

  const check = checkMirrorEndpoint(endpoint);
  if (!check.ok) {
    logger.error('espelho de storage recusado pelo endpoint — seguindo desligado', {
      reason: check.reason,
    });
    return null;
  }

  return {
    endpoint: check.url.origin,
    region: readTrimmed('STORAGE_MIRROR_REGION') || 'us-east-1',
    keyPrefix: readTrimmed('STORAGE_MIRROR_KEY_PREFIX'),
    accessKeyId,
    secretAccessKey,
    forcePathStyle: readBooleanEnv('STORAGE_MIRROR_FORCE_PATH_STYLE', true),
    maxObjectBytes:
      readPositiveInt('STORAGE_MIRROR_MAX_OBJECT_MB', DEFAULT_MAX_OBJECT_MB) * 1024 * 1024,
    requestTimeoutMs: readPositiveInt(
      'STORAGE_MIRROR_REQUEST_TIMEOUT_MS',
      DEFAULT_REQUEST_TIMEOUT_MS,
    ),
  };
}

export function isStorageMirrorEnabled(): boolean {
  return getStorageMirrorConfig() !== null;
}

/**
 * O espelho não tem regra de endereço própria: ele copia a do R2.
 *
 * **Bucket.** É o mesmo nome que o R2 resolveu, e não um bucket único do espelho. Isso importa
 * porque o nome do bucket *é* a fronteira de isolamento no desenho atual: tenant PJ ganha bucket
 * próprio (`doqyn-{env}-t-{slug}-{hash}`, função pura do `tenantId`), e tenant PF cai no bucket
 * compartilhado sob um prefixo opaco (`individuals/{hash}`). Um bucket único no espelho achataria
 * tudo isso numa pilha só — a chave ainda carregaria o tenant, mas a fronteira de bucket, que é o
 * que permite política e credencial por tenant, deixaria de existir do lado do espelho.
 *
 * **Chave.** Idêntica, com prefixo global opcional. Manter a chave igual é o que torna a leitura
 * de emergência trivial: quem sabe o endereço no R2 sabe o endereço aqui, sem tabela de tradução
 * para envelhecer.
 *
 * Consequência: quem provisiona o espelho precisa criar os mesmos buckets, e é por isso que a
 * escrita cria o bucket que faltar em vez de exigir provisionamento à mão.
 */
export function buildMirrorKey(config: StorageMirrorConfig, objectKey: string): string {
  const prefix = config.keyPrefix.replace(/^\/+|\/+$/g, '');
  const key = objectKey.replace(/^\/+/, '');
  return prefix ? `${prefix}/${key}` : key;
}
