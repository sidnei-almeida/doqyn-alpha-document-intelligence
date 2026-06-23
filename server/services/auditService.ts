import { connectMongo } from '../db/mongo.js';
import { AuditEventModel } from '../models/AuditEvent.js';

export async function listAuditEvents(filters: {
  tenantId?: string;
  documentId?: string;
  limit?: number;
}) {
  await connectMongo();

  if (!process.env.MONGODB_URI) {
    return { events: [], total: 0 };
  }

  const query: Record<string, unknown> = {};
  if (filters.tenantId) query.tenantId = filters.tenantId;
  if (filters.documentId) query.documentId = filters.documentId;

  const limit = filters.limit ?? 50;
  const events = await AuditEventModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  const total = await AuditEventModel.countDocuments(query);

  return {
    events: events.map((e) => ({
      id: String(e._id),
      tenantId: e.tenantId,
      documentId: e.documentId,
      actorUserId: e.actorUserId,
      actorName: e.actorName,
      action: e.action,
      description: e.description,
      area: e.area,
      result: e.result,
      createdAt: e.createdAt,
      metadata: e.metadata,
    })),
    total,
  };
}

export async function createAuditEvent(input: {
  tenantId: string;
  documentId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  description: string;
  area?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}) {
  await connectMongo();

  if (!process.env.MONGODB_URI) return null;

  const event = await AuditEventModel.create(input);
  return { id: event._id.toString(), ...input, createdAt: event.createdAt };
}
