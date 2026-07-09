import { isMongoNativeConfigured } from '../../db/mongoClient.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import type { DocumentAuditContext } from '../../audit/documentAuditTypes.js';

export type TrackingSummary = {
  period: { from: string; to: string };
  totalEvents: number;
  previews: number;
  downloads: number;
  accessDenied: number;
  errors: number;
  uniqueDocuments: number;
  uniqueActors: number;
  topDocuments: Array<{ documentId: string; count: number }>;
  topDownloaders: Array<{ userId: string; displayName?: string; count: number }>;
};

function defaultPeriod(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from, to };
}

export async function getTrackingSummary(input: {
  ctx: DocumentAuditContext;
  from?: string;
  to?: string;
}): Promise<TrackingSummary> {
  const period = defaultPeriod();
  if (input.from) {
    const parsed = new Date(input.from);
    if (!Number.isNaN(parsed.getTime())) period.from = parsed;
  }
  if (input.to) {
    const parsed = new Date(input.to);
    if (!Number.isNaN(parsed.getTime())) period.to = parsed;
  }

  if (!isMongoNativeConfigured()) {
    return {
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      totalEvents: 0,
      previews: 0,
      downloads: 0,
      accessDenied: 0,
      errors: 0,
      uniqueDocuments: 0,
      uniqueActors: 0,
      topDocuments: [],
      topDownloaders: [],
    };
  }

  const ownerUserId = input.ctx.ownerUserId ?? input.ctx.actorUserId;
  const { auditLogs, storage } = await getTenantCollections(input.ctx.tenantId, {
    userId: ownerUserId,
    membershipId: input.ctx.actorMembershipId,
  });

  const match: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    action: { $regex: '^(document\\.|access\\.|file_explorer\\.)' },
    createdAt: { $gte: period.from, $lte: period.to },
  };

  const [stats] = await auditLogs
    .aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                previews: {
                  $sum: {
                    $cond: [{ $eq: ['$action', 'document.preview_viewed'] }, 1, 0],
                  },
                },
                downloads: {
                  $sum: {
                    $cond: [{ $eq: ['$action', 'document.downloaded'] }, 1, 0],
                  },
                },
                accessDenied: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ['$action', 'access.document_denied'] },
                          { $eq: ['$metadata.status', 'denied'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                errors: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ['$result', 'error'] },
                          { $eq: ['$metadata.status', 'failed'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                documents: { $addToSet: '$documentId' },
                actors: { $addToSet: '$actor.userId' },
              },
            },
          ],
          topDocuments: [
            { $match: { documentId: { $ne: null } } },
            { $group: { _id: '$documentId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          topDownloaders: [
            { $match: { action: 'document.downloaded' } },
            {
              $group: {
                _id: '$actor.userId',
                count: { $sum: 1 },
                displayName: { $first: '$actor.displayNameSnapshot' },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ])
    .toArray();

  const totals = (stats?.totals?.[0] as Record<string, unknown>) ?? {};

  return {
    period: { from: period.from.toISOString(), to: period.to.toISOString() },
    totalEvents: Number(totals.totalEvents ?? 0),
    previews: Number(totals.previews ?? 0),
    downloads: Number(totals.downloads ?? 0),
    accessDenied: Number(totals.accessDenied ?? 0),
    errors: Number(totals.errors ?? 0),
    uniqueDocuments: Array.isArray(totals.documents) ? totals.documents.filter(Boolean).length : 0,
    uniqueActors: Array.isArray(totals.actors) ? totals.actors.filter(Boolean).length : 0,
    topDocuments: ((stats?.topDocuments as Array<{ _id: string; count: number }>) ?? []).map(
      (row) => ({ documentId: row._id, count: row.count }),
    ),
    topDownloaders: (
      (stats?.topDownloaders as Array<{ _id: string; count: number; displayName?: string }>) ?? []
    ).map((row) => ({
      userId: row._id,
      displayName: row.displayName,
      count: row.count,
    })),
  };
}
