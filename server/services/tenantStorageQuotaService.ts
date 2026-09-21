import { REGISTRY_COLLECTIONS } from '../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoTenant } from '../db/types.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { logger } from '../utils/logger.js';

/**
 * Teto de armazenamento do espaço, e o portão que o cobra.
 *
 * A cota era só um número na tela: `tenantUsageService` somava os bytes e desenhava a barra, e
 * nenhum caminho de envio lia o resultado. Um tenant subia o quanto quisesse para o R2 enquanto a
 * barra continuava dizendo "10 GB".
 *
 * ## Onde cobra
 *
 * No presign (`api/documents/upload-url.ts`), antes de o arquivo existir em qualquer lugar. Recusar
 * depois do upload significaria apagar do R2 em dois lugares — a chave final e o provisório `tmp/`
 * de onde a fila copia — e um caminho de limpeza que falha em silêncio deixa lixo cobrando.
 *
 * O tamanho vem declarado pelo cliente. Isso basta para o caso honesto, que é o que estoura cota na
 * prática; quem mentir o tamanho ainda encontra o teto de arquivo (`maxUploadBytes`) e o limite de
 * envios por hora.
 *
 * ## O que conta
 *
 * Só o byte que o tenant mandou — o original da versão. A miniatura é trabalho que o sistema faz
 * por conta própria, e cobrá-la de quem enviou faria a conta crescer sem ninguém ter enviado nada.
 * A barra da tela ainda mostra original + miniatura, então os dois números não são o mesmo; o da
 * barra é o que ocupa o disco, este é o que a cota governa.
 *
 * ## Por que um contador, e não a soma
 *
 * A soma exata é um `$group` sobre as versões do tenant. Rodá-la a cada envio é varredura no
 * caminho quente, que cresce com o acervo. O contador vive no registro do tenant e é `$inc` de uma
 * linha na confirmação, com leitura O(1).
 *
 * Contador pode divergir do real — por isso ele nunca *recusa* sozinho. Estando no teto, o portão
 * refaz a soma exata antes de barrar: um contador que derivou para cima não tranca ninguém por
 * engano, e quem assina a recusa é o número de verdade. `scripts/reconcile-tenant-storage.ts`
 * reconcilia os dois.
 *
 * Nada libera bytes hoje: a exclusão permanente foi descontinuada e documento vencido na lixeira é
 * desativado, não apagado. O contador é monotônico de propósito, e só é somado no fim de uma
 * confirmação bem-sucedida — rollback nunca chega lá, então não há o que subtrair.
 */
const DEFAULT_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

export function readStorageQuotaBytes(): number | null {
  const raw = process.env.TENANT_STORAGE_QUOTA_BYTES?.trim();
  if (!raw) return DEFAULT_STORAGE_QUOTA_BYTES;
  // Zero (ou lixo) desliga a cota em vez de inventar um teto.
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

type TenantStorageCounter = { usage?: { storedBytes?: number } };

/**
 * Lê o contador direto do Mongo, sem passar pelo cache de `resolveTenant`.
 *
 * O registro do tenant fica 90s em cache no Redis. Invalidar esse cache a cada envio custaria uma
 * releitura do registry em toda requisição do tenant, para um campo que só este portão lê — então o
 * campo é lido à parte, e a cópia cacheada segue com o contador velho que ninguém consulta.
 */
export async function readTenantStoredBytes(tenantId: string): Promise<number> {
  if (!isMongoNativeConfigured()) return 0;

  const db = await getDb();
  const row = await db
    .collection<MongoTenant & TenantStorageCounter>(REGISTRY_COLLECTIONS.tenants)
    .findOne({ tenantId }, { projection: { 'usage.storedBytes': 1 } });

  const stored = row?.usage?.storedBytes;
  return typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? stored : 0;
}

/**
 * Soma exata dos originais guardados. É a referência: o contador responde a ela, não o contrário.
 *
 * Recorta por `tenantId` cru, e não por `tenantScopeFilterFromContext`. Aquele filtro é de
 * propriedade: em tenant PF ele exige `ownerUserId` e estoura com `OWNER_USER_REQUIRED` quando não
 * recebe um. A cota é do espaço inteiro, não de um usuário dentro dele — e `tenantId` é gravado em
 * toda versão por `applyDocumentOwnershipOnInsert`, nos dois modos de armazenamento.
 */
export async function sumTenantStoredBytes(tenantId: string): Promise<number> {
  if (!isMongoNativeConfigured()) return 0;

  const collections = await getTenantCollections(tenantId, {});
  const rows = await collections.documentVersions
    .aggregate<{ originalBytes?: number }>([
      { $match: { tenantId } },
      {
        $group: {
          _id: null,
          originalBytes: {
            $sum: {
              $cond: [
                { $eq: ['$storage.primary.status', 'stored'] },
                { $ifNull: ['$file.sizeBytes', 0] },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  return rows[0]?.originalBytes ?? 0;
}

/**
 * Soma bytes ao contador do tenant. Chamada no fim de uma confirmação que guardou o original.
 *
 * Nunca derruba a confirmação: o documento já está guardado e contabilizado no Mongo quando esta
 * linha roda. Contador que não somou é divergência que a reconciliação conserta — e é um erro menos
 * grave que recusar um envio que deu certo.
 */
export async function addTenantStoredBytes(tenantId: string, bytes: number): Promise<void> {
  if (!isMongoNativeConfigured()) return;
  if (!Number.isFinite(bytes) || bytes <= 0) return;

  try {
    const db = await getDb();
    await db
      .collection(REGISTRY_COLLECTIONS.tenants)
      .updateOne({ tenantId }, { $inc: { 'usage.storedBytes': Math.floor(bytes) } });
  } catch (error) {
    logger.warn('contador de armazenamento do tenant não somou', {
      tenantId,
      bytes,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export type TenantStorageDecision = {
  quotaBytes: number | null;
  storedBytes: number;
  incomingBytes: number;
};

/**
 * Portão de volume. Deixa passar quando não há cota, e recusa só com a soma exata na mão.
 *
 * `allowWhenVersion` é o caso de nova versão de documento que já existe: trocar um contrato pela
 * versão corrigida não faz o acervo crescer, e travar isso prenderia a pessoa no documento errado.
 * O que para no teto é entrar documento novo.
 */
export async function assertTenantStorageAvailable(input: {
  tenantId: string;
  incomingBytes: number;
  isNewVersion?: boolean;
}): Promise<TenantStorageDecision> {
  const quotaBytes = readStorageQuotaBytes();
  const incomingBytes = Number.isFinite(input.incomingBytes) ? Math.max(0, input.incomingBytes) : 0;

  if (quotaBytes === null || input.isNewVersion) {
    return { quotaBytes, storedBytes: 0, incomingBytes };
  }

  const counted = await readTenantStoredBytes(input.tenantId);
  if (counted + incomingBytes <= quotaBytes) {
    return { quotaBytes, storedBytes: counted, incomingBytes };
  }

  // O contador disse que estourou. Antes de barrar, confere com a soma real e realinha o contador,
  // para que a próxima tentativa não pague o mesmo `$group`.
  const actual = await sumTenantStoredBytes(input.tenantId);
  if (actual !== counted) {
    await setTenantStoredBytes(input.tenantId, actual);
  }

  if (actual + incomingBytes <= quotaBytes) {
    return { quotaBytes, storedBytes: actual, incomingBytes };
  }

  throw new ServiceError(
    'O espaço de armazenamento do plano acabou. Desative documentos que não usa mais, ou fale com quem administra o espaço.',
    'TENANT_STORAGE_QUOTA_EXCEEDED',
    413,
  );
}

/** Grava o contador com um valor conhecido. Usada pela reconciliação e pelo realinhamento do portão. */
export async function setTenantStoredBytes(tenantId: string, bytes: number): Promise<void> {
  if (!isMongoNativeConfigured()) return;

  const value = Number.isFinite(bytes) && bytes > 0 ? Math.floor(bytes) : 0;
  const db = await getDb();
  await db
    .collection(REGISTRY_COLLECTIONS.tenants)
    .updateOne(
      { tenantId },
      { $set: { 'usage.storedBytes': value, 'usage.reconciledAt': new Date() } },
    );
}
