import type { Collection } from 'mongodb';
import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentVersion } from '../db/types.js';
import { DOCUMENT_AUDIT_ACTION_LABELS } from '../audit/documentAuditTypes.js';
import { isDocumentAdmin, loadDocumentAccessContext } from '../tenancy/documentAccess.js';
import { listGovernanceViewableCategoryIds } from '../tenancy/governanceAccessIndex.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../tenancy/tenantQuery.js';
import type { TenantStorageContext } from '../tenancy/tenantStorage.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { listAuditEvents } from './auditService.js';
import { listDocuments } from './documentService.js';
import { listOperationalTenantMembers } from './tenantMemberRepository.js';
import { isStorageConfigured } from '../storage/index.js';
import { isLegacyTenantBucketName } from '../storage/r2/r2BucketNaming.js';

export type DashboardPeriodKey = '7d' | '30d' | '90d';

export type DashboardOverviewResponse = {
  generatedAt: string;
  mode: 'full' | 'operational';
  tenant: {
    tenantId: string;
    tenantType: string;
    displayName: string;
  };
  period: {
    from: string;
    to: string;
    key: DashboardPeriodKey;
  };
  summary: {
    totalDocuments: number;
    documentsUploadedToday: number;
    documentsUploadedInPeriod: number;
    documentsInAnalysis: number;
    documentsAwaitingReview: number;
    documentsProcessed: number;
    documentsWithErrors: number;
    totalVersions: number;
    previewReady: number;
    previewFailed: number;
    downloadsInPeriod: number;
    viewsInPeriod: number;
    trackingEventsInPeriod: number;
  };
  governance: {
    documentCategories: number;
    documentGroups: number;
    activeExtractionRules: number;
    activeAccessRules: number;
    documentsWithoutCategory: number;
    usersActive: number;
    usersPending: number;
    accessRequestsPending: number;
  } | null;
  storage: {
    originalFiles: number;
    previewFiles: number;
    totalSizeBytes: number;
    originalSizeBytes: number;
    previewSizeBytes: number;
    bucketNameMasked: string | null;
  } | null;
  documentsByStatus: Array<{ status: string; label: string; count: number }>;
  documentsByCategory: Array<{ categoryId: string; categoryName: string; count: number }>;
  recentDocuments: Awaited<ReturnType<typeof listDocuments>>['items'];
  recentTrackingEvents: Array<{
    id: string;
    action: string;
    label: string;
    documentId?: string | null;
    documentName?: string;
    actorName?: string;
    severity: string;
    occurredAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    action: string;
    documentName?: string;
    message: string;
    occurredAt: string;
  }>;
  health: {
    analysisReady: boolean;
    hasActiveCategories: boolean;
    hasActiveExtractionRules: boolean;
    hasStorageConfigured: boolean;
    warnings: string[];
  };
};

function resolvePeriod(input: { period?: string; from?: string; to?: string }): {
  from: Date;
  to: Date;
  key: DashboardPeriodKey;
} {
  const now = new Date();
  const to = input.to?.trim() ? new Date(input.to.trim()) : now;
  if (Number.isNaN(to.getTime())) {
    throw new ServiceError('Parâmetro to inválido.', 'INVALID_PERIOD', 400);
  }

  let key: DashboardPeriodKey = '30d';
  if (input.period === '7d' || input.period === '30d' || input.period === '90d') {
    key = input.period;
  }

  let from: Date;
  if (input.from?.trim()) {
    from = new Date(input.from.trim());
    if (Number.isNaN(from.getTime())) {
      throw new ServiceError('Parâmetro from inválido.', 'INVALID_PERIOD', 400);
    }
  } else {
    from = new Date(to);
    const days = key === '7d' ? 7 : key === '90d' ? 90 : 30;
    from.setDate(from.getDate() - days);
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to, key };
}

function maskBucketName(bucketName: string | undefined | null): string | null {
  if (!bucketName?.trim()) return null;
  const name = bucketName.trim();
  if (name.length <= 12) return name;
  return `${name.slice(0, 14)}...${name.slice(-6)}`;
}

export function buildAccessibleDocumentQuery(
  storage: TenantStorageContext,
  user: AuthUser,
  isAdmin: boolean,
  governanceViewCategoryIds: string[] = [],
): Record<string, unknown> {
  const tenantScope = tenantScopeFilterFromContext(storage);

  const query: Record<string, unknown> = {
    ...tenantScope,
    status: 'active',
    deletedAt: { $in: [null, undefined] },
    permanentlyDeletedAt: { $in: [null, undefined] },
    deactivatedAt: { $in: [null, undefined] },
  };

  if (!isAdmin) {
    const accessClauses: Record<string, unknown>[] = [{ ownerUserId: user.id }];

    if (governanceViewCategoryIds.length > 0) {
      accessClauses.push({ classId: { $in: governanceViewCategoryIds } });
    }

    // `$and` explícito porque o escopo de tenant empresarial JÁ é um `$or`
    // (`{ $or: [{ tenantId }, { companyId }] }`). Atribuir `query.$or` aqui apagava esse escopo, e
    // desde que os dados vivem em coleção compartilhada isso deixava a agregação sem nenhum filtro
    // de tenant: o painel somaria documentos de outros tenants que o usuário possui.
    delete query.$or;
    query.$and = [tenantScope, { $or: accessClauses }];
  }

  return query;
}

function mapStatusBucket(processingStatus?: string): string {
  if (processingStatus === 'requires_review') return 'awaiting_review';
  if (processingStatus === 'pending') return 'in_analysis';
  if (processingStatus === 'processed' || processingStatus === 'processed_with_review') {
    return 'processed';
  }
  return 'other';
}

const STATUS_LABELS: Record<string, string> = {
  processed: 'Processados',
  in_analysis: 'Em análise',
  awaiting_review: 'Aguardando revisão',
  error: 'Com erro',
  other: 'Outros',
};

/** Quantas categorias o painel exibe. Recortado no servidor, não no Node. */
const CATEGORY_FACET_LIMIT = 8;

type DocumentFacets = {
  totalDocuments: number;
  documentsUploadedToday: number;
  documentsUploadedInPeriod: number;
  statusCounts: Map<string, number>;
  categories: { categoryId: string; categoryName: string; count: number }[];
  documentsWithoutCategory: number;
};

type FacetCountRow = { count?: number };
type FacetStatusRow = { _id?: string | null; count?: number };
type FacetCategoryRow = { _id?: string | null; categoryName?: string | null; count?: number };

function firstCount(rows: FacetCountRow[] | undefined): number {
  return rows?.[0]?.count ?? 0;
}

/**
 * Um único `aggregate` no lugar de cinco consultas — três `countDocuments` e duas varreduras
 * completas que traziam todos os documentos do tenant para a memória do Node só para contar.
 *
 * O agrupamento acontece no servidor, então o volume trafegado é constante: não cresce com o
 * tamanho do tenant. Os ramos de data pegam carona no mesmo `$match`, que já precisa varrer o
 * conjunto acessível para agrupar status e categoria.
 */
async function aggregateDocumentFacets(
  documents: Collection<MongoDocument>,
  docQuery: Record<string, unknown>,
  startOfToday: Date,
  period: { from: Date; to: Date },
): Promise<DocumentFacets> {
  const hasCategory = { $and: [{ $ne: ['$_classId', ''] }, { $ne: ['$_className', ''] }] };

  const [row] = await documents
    .aggregate<{
      total?: FacetCountRow[];
      today?: FacetCountRow[];
      inPeriod?: FacetCountRow[];
      byStatus?: FacetStatusRow[];
      byCategory?: FacetCategoryRow[];
      withoutCategory?: FacetCountRow[];
    }>([
      { $match: docQuery },
      {
        $project: {
          _id: 0,
          createdAt: 1,
          processingStatus: 1,
          // `$trim` reproduz o `.trim()` que o código fazia em memória, para que documento com
          // classId só de espaços continue contando como "sem categoria".
          _classId: { $trim: { input: { $ifNull: ['$classId', ''] } } },
          _className: { $trim: { input: { $ifNull: ['$className', ''] } } },
        },
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          today: [{ $match: { createdAt: { $gte: startOfToday } } }, { $count: 'count' }],
          inPeriod: [
            { $match: { createdAt: { $gte: period.from, $lte: period.to } } },
            { $count: 'count' },
          ],
          byStatus: [{ $group: { _id: '$processingStatus', count: { $sum: 1 } } }],
          byCategory: [
            { $match: { $expr: hasCategory } },
            {
              $group: {
                _id: '$_classId',
                categoryName: { $first: '$_className' },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: CATEGORY_FACET_LIMIT },
          ],
          withoutCategory: [{ $match: { $expr: { $not: hasCategory } } }, { $count: 'count' }],
        },
      },
    ])
    .toArray();

  // `mapStatusBucket` continua no Node: são no máximo uma dúzia de linhas agrupadas, e manter a
  // regra em TypeScript evita duplicá-la em expressão de agregação.
  const statusCounts = new Map<string, number>();
  for (const status of row?.byStatus ?? []) {
    const bucket = mapStatusBucket(status._id ?? undefined);
    statusCounts.set(bucket, (statusCounts.get(bucket) ?? 0) + (status.count ?? 0));
  }

  return {
    totalDocuments: firstCount(row?.total),
    documentsUploadedToday: firstCount(row?.today),
    documentsUploadedInPeriod: firstCount(row?.inPeriod),
    statusCounts,
    categories: (row?.byCategory ?? [])
      .filter((item): item is FacetCategoryRow & { _id: string } => Boolean(item._id))
      .map((item) => ({
        categoryId: item._id,
        categoryName: item.categoryName ?? item._id,
        count: item.count ?? 0,
      })),
    documentsWithoutCategory: firstCount(row?.withoutCategory),
  };
}

export async function getDashboardOverview(input: {
  tenantId: string;
  userId: string;
  membershipId?: string;
  user: AuthUser;
  period?: string;
  from?: string;
  to?: string;
}): Promise<DashboardOverviewResponse> {
  const tenantId = input.tenantId?.trim();
  if (!tenantId) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }

  const period = resolvePeriod(input);
  const isAdmin = isDocumentAdmin(input.user);
  const mode: DashboardOverviewResponse['mode'] = isAdmin ? 'full' : 'operational';

  if (!isMongoNativeConfigured()) {
    return {
      generatedAt: new Date().toISOString(),
      mode,
      tenant: { tenantId, tenantType: 'business', displayName: tenantId },
      period: { from: period.from.toISOString(), to: period.to.toISOString(), key: period.key },
      summary: {
        totalDocuments: 0,
        documentsUploadedToday: 0,
        documentsUploadedInPeriod: 0,
        documentsInAnalysis: 0,
        documentsAwaitingReview: 0,
        documentsProcessed: 0,
        documentsWithErrors: 0,
        totalVersions: 0,
        previewReady: 0,
        previewFailed: 0,
        downloadsInPeriod: 0,
        viewsInPeriod: 0,
        trackingEventsInPeriod: 0,
      },
      governance: isAdmin
        ? {
            documentCategories: 0,
            documentGroups: 0,
            activeExtractionRules: 0,
            activeAccessRules: 0,
            documentsWithoutCategory: 0,
            usersActive: 0,
            usersPending: 0,
            accessRequestsPending: 0,
          }
        : null,
      storage: isAdmin
        ? {
            originalFiles: 0,
            previewFiles: 0,
            totalSizeBytes: 0,
            originalSizeBytes: 0,
            previewSizeBytes: 0,
            bucketNameMasked: null,
          }
        : null,
      documentsByStatus: [],
      documentsByCategory: [],
      recentDocuments: [],
      recentTrackingEvents: [],
      recentErrors: [],
      health: {
        analysisReady: false,
        hasActiveCategories: false,
        hasActiveExtractionRules: false,
        hasStorageConfigured: isStorageConfigured(),
        warnings: ['MongoDB não configurado.'],
      },
    };
  }

  const collections = await getTenantCollections(tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const governanceViewCategoryIds = isAdmin
    ? []
    : listGovernanceViewableCategoryIds(governanceIndex, memberGroupIds);

  const docQuery = buildAccessibleDocumentQuery(
    collections.storage,
    input.user,
    isAdmin,
    governanceViewCategoryIds,
  );
  const scope = tenantScopeFilterFromContext(collections.storage);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    documentFacets,
    totalVersions,
    previewReady,
    previewFailed,
    downloadsInPeriod,
    viewsInPeriod,
    trackingEventsInPeriod,
    recentDocsResult,
    recentEventsResult,
    recentErrorsResult,
  ] = await Promise.all([
    aggregateDocumentFacets(collections.documents, docQuery, startOfToday, period),
    collections.documentVersions.countDocuments(scope as Record<string, unknown>),
    collections.documentVersions.countDocuments({
      ...scope,
      'storage.preview.status': 'ready',
    } as Record<string, unknown>),
    collections.documentVersions.countDocuments({
      ...scope,
      'storage.preview.status': 'failed',
    } as Record<string, unknown>),
    collections.auditLogs.countDocuments({
      ...scope,
      action: 'document.downloaded',
      createdAt: { $gte: period.from, $lte: period.to },
    } as Record<string, unknown>),
    collections.auditLogs.countDocuments({
      ...scope,
      action: 'document.preview_viewed',
      createdAt: { $gte: period.from, $lte: period.to },
    } as Record<string, unknown>),
    // Sem `$options: 'i'`: regex case-insensitive anula o índice
    // { tenantId, action, createdAt } mesmo ancorada. `action` é gravada em minúsculas
    // (`documentAuditLogService.createDocumentAuditLog`), então a busca sensível a caixa basta.
    collections.auditLogs.countDocuments({
      ...scope,
      action: { $regex: '^document\\.' },
      createdAt: { $gte: period.from, $lte: period.to },
    } as Record<string, unknown>),
    listDocuments({
      tenantId,
      ownerUserId: input.userId,
      membershipId: input.membershipId,
      user: input.user,
      limit: 6,
    }),
    listAuditEvents({
      tenantId,
      ownerUserId: input.userId,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      limit: 8,
    }),
    listAuditEvents({
      tenantId,
      ownerUserId: input.userId,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      limit: 5,
      severity: 'error',
    }),
  ]);

  const {
    totalDocuments,
    documentsUploadedToday,
    documentsUploadedInPeriod,
    statusCounts,
    documentsWithoutCategory,
  } = documentFacets;

  const documentsInAnalysis = statusCounts.get('in_analysis') ?? 0;
  const documentsAwaitingReview = statusCounts.get('awaiting_review') ?? 0;
  const documentsProcessed = statusCounts.get('processed') ?? 0;
  const documentsWithErrors = previewFailed + (statusCounts.get('other') ?? 0);

  const documentsByStatus = ['processed', 'in_analysis', 'awaiting_review', 'error']
    .map((status) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count:
        status === 'error'
          ? documentsWithErrors
          : status === 'in_analysis'
            ? documentsInAnalysis
            : status === 'awaiting_review'
              ? documentsAwaitingReview
              : documentsProcessed,
    }))
    .filter((item) => item.count > 0);

  // Já vem ordenado e recortado pelo `$facet` — o Node não reordena nada.
  const documentsByCategory = documentFacets.categories;

  const [activeCategories, activeExtractionRules] = await Promise.all([
    collections.documentCategories
      ? collections.documentCategories.countDocuments({ ...scope, active: true } as Record<
          string,
          unknown
        >)
      : Promise.resolve(0),
    collections.documentExtractionRules
      ? collections.documentExtractionRules.countDocuments({ ...scope, active: true } as Record<
          string,
          unknown
        >)
      : Promise.resolve(0),
  ]);

  let governance: DashboardOverviewResponse['governance'] = null;
  let storage: DashboardOverviewResponse['storage'] = null;

  if (isAdmin) {
    const [categories, groups, extractionRules, accessRules, members, storageVersions] =
      await Promise.all([
        Promise.resolve(activeCategories),
        collections.documentGroups
          ? collections.documentGroups.countDocuments({ ...scope, active: true } as Record<
              string,
              unknown
            >)
          : Promise.resolve(0),
        Promise.resolve(activeExtractionRules),
        collections.documentRules
          ? collections.documentRules.countDocuments({ ...scope, active: true } as Record<
              string,
              unknown
            >)
          : Promise.resolve(0),
        listOperationalTenantMembers(tenantId),
        collections.documentVersions
          .find(scope as Record<string, unknown>)
          .project({ file: 1, storage: 1 })
          .toArray(),
      ]);

    const usersActive = members.filter((m) => m.status === 'active').length;
    const usersPending = members.filter((m) => m.status === 'pending').length;

    governance = {
      documentCategories: categories,
      documentGroups: groups,
      activeExtractionRules: extractionRules,
      activeAccessRules: accessRules,
      documentsWithoutCategory,
      usersActive,
      usersPending,
      accessRequestsPending: usersPending,
    };

    let originalFiles = 0;
    let previewFiles = 0;
    let originalSizeBytes = 0;
    let previewSizeBytes = 0;

    for (const version of storageVersions as MongoDocumentVersion[]) {
      if (version.storage?.primary?.status === 'stored') {
        originalFiles += 1;
        originalSizeBytes += version.file?.sizeBytes ?? 0;
      }
      if (version.storage?.preview?.status === 'ready') {
        previewFiles += 1;
        previewSizeBytes += version.storage.preview.sizeBytes ?? 0;
      }
    }

    const bucketRaw =
      collections.tenant.storage?.bucketName ?? collections.tenant.storage?.bucketAlias;
    storage = {
      originalFiles,
      previewFiles,
      totalSizeBytes: originalSizeBytes + previewSizeBytes,
      originalSizeBytes,
      previewSizeBytes,
      bucketNameMasked: maskBucketName(bucketRaw),
    };
  }

  const recentTrackingEvents = recentEventsResult.events
    .filter((event) => event.action.startsWith('document.'))
    .map((event) => ({
      id: event.id,
      action: event.action,
      label: DOCUMENT_AUDIT_ACTION_LABELS[event.action] ?? event.description,
      documentId: event.documentId,
      documentName:
        typeof event.metadata?.documentName === 'string' ? event.metadata.documentName : undefined,
      actorName: event.actorName,
      severity: event.severity,
      occurredAt: event.createdAt,
    }));

  const recentErrors = recentErrorsResult.events
    .filter((event) => event.action.includes('failed') || event.severity === 'error')
    .map((event) => ({
      id: event.id,
      action: event.action,
      documentName:
        typeof event.metadata?.documentName === 'string' ? event.metadata.documentName : undefined,
      message: event.description,
      occurredAt: event.createdAt,
    }));

  const warnings: string[] = [];
  if (!isStorageConfigured()) warnings.push('Storage não configurado.');
  if (activeCategories === 0) {
    warnings.push(
      isAdmin
        ? 'Nenhuma categoria documental ativa.'
        : 'Categorias ainda não configuradas pelo administrador.',
    );
  }
  if (activeExtractionRules === 0) {
    warnings.push(
      isAdmin
        ? 'Nenhuma regra de extração ativa.'
        : 'Regras de IA ainda não configuradas pelo administrador.',
    );
  }
  if (
    collections.tenant.storage?.bucketName &&
    isLegacyTenantBucketName(collections.tenant.storage.bucketName)
  ) {
    warnings.push('Bucket de storage usa nomenclatura legada.');
  }

  return {
    generatedAt: new Date().toISOString(),
    mode,
    tenant: {
      tenantId: collections.tenant.tenantId,
      tenantType: collections.tenant.tenantType,
      displayName: collections.tenant.displayName,
    },
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      key: period.key,
    },
    summary: {
      totalDocuments,
      documentsUploadedToday,
      documentsUploadedInPeriod,
      documentsInAnalysis,
      documentsAwaitingReview,
      documentsProcessed,
      documentsWithErrors,
      totalVersions,
      previewReady,
      previewFailed,
      downloadsInPeriod,
      viewsInPeriod,
      trackingEventsInPeriod,
    },
    governance,
    storage,
    documentsByStatus,
    documentsByCategory,
    recentDocuments: recentDocsResult.items,
    recentTrackingEvents,
    recentErrors,
    health: {
      analysisReady: activeExtractionRules > 0 && activeCategories > 0,
      hasActiveCategories: activeCategories > 0,
      hasActiveExtractionRules: activeExtractionRules > 0,
      hasStorageConfigured: isStorageConfigured(),
      warnings,
    },
  };
}
