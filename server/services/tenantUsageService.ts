import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { isDocumentAdmin, loadDocumentAccessContext } from '../tenancy/documentAccess.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { listGovernanceViewableCategoryIds } from '../tenancy/governanceAccessIndex.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import { buildAccessibleDocumentQuery } from './dashboardOverviewService.js';

export type TenantUsageResponse = {
  generatedAt: string;
  /** Documentos que este usuário enxerga — não o total do tenant. */
  documents: number;
  storage: {
    totalBytes: number;
    originalBytes: number;
    previewBytes: number;
    /** Teto de armazenamento do espaço. `null` quando não há cota configurada. */
    quotaBytes: number | null;
  };
};

/**
 * Cota de armazenamento do espaço.
 *
 * ATENÇÃO: hoje isto é só um número para a tela. Nada no caminho de upload lê
 * este valor, então estourar a cota não bloqueia envio — a barra informa, não
 * governa. Quando existir cobrança por plano, o teto passa a sair do registro
 * do tenant (como `tenant.quotas`) e esta constante vira o padrão de quem não
 * tem plano atribuído.
 */
const DEFAULT_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

function readStorageQuotaBytes(): number | null {
  const raw = process.env.TENANT_STORAGE_QUOTA_BYTES?.trim();
  if (!raw) return DEFAULT_STORAGE_QUOTA_BYTES;
  // Zero (ou lixo) desliga a barra em vez de mostrar um teto inventado.
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

const EMPTY_USAGE: Omit<TenantUsageResponse, 'generatedAt'> = {
  documents: 0,
  storage: { totalBytes: 0, originalBytes: 0, previewBytes: 0, quotaBytes: null },
};

type StorageSumRow = {
  originalBytes?: number;
  previewBytes?: number;
};

/**
 * Uso do tenant para o rodapé da barra lateral: quantos documentos e quantos bytes.
 *
 * Existe separado do painel de propósito. O `getDashboardOverview` responde a
 * mesma pergunta, mas para chegar lá ele varre auditoria, tracking, versões e
 * governança — custo que faz sentido uma vez, numa tela que a pessoa abriu para
 * isso, e não em toda navegação do app.
 *
 * A soma de bytes é feita pelo servidor de banco, num `$group`. O painel traz
 * todas as versões para a memória do Node e soma lá; num tenant grande isso é
 * tráfego que cresce com o acervo, e aqui o volume é constante.
 */
export async function getTenantUsage(input: {
  tenantId: string;
  userId: string;
  membershipId?: string;
  user: AuthUser;
}): Promise<TenantUsageResponse> {
  const generatedAt = new Date().toISOString();
  if (!isMongoNativeConfigured()) return { generatedAt, ...EMPTY_USAGE };

  const collections = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const isAdmin = isDocumentAdmin(input.user);

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: input.tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const documentQuery = buildAccessibleDocumentQuery(
    collections.storage,
    input.user,
    isAdmin,
    isAdmin ? [] : listGovernanceViewableCategoryIds(governanceIndex, memberGroupIds),
  );

  const scope = tenantScopeFilterFromContext(collections.storage);

  const [documents, storageRows] = await Promise.all([
    collections.documents.countDocuments(documentQuery),
    collections.documentVersions
      .aggregate<StorageSumRow>([
        { $match: scope as Record<string, unknown> },
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
            previewBytes: {
              $sum: {
                $cond: [
                  { $eq: ['$storage.preview.status', 'ready'] },
                  { $ifNull: ['$storage.preview.sizeBytes', 0] },
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray(),
  ]);

  const originalBytes = storageRows[0]?.originalBytes ?? 0;
  const previewBytes = storageRows[0]?.previewBytes ?? 0;

  return {
    generatedAt,
    documents,
    storage: {
      totalBytes: originalBytes + previewBytes,
      originalBytes,
      previewBytes,
      quotaBytes: readStorageQuotaBytes(),
    },
  };
}
