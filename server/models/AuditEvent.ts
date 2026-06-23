import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const auditEventSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    documentId: { type: String, required: true, index: true },
    actorUserId: { type: String, required: true },
    actorName: { type: String, required: true },
    action: {
      type: String,
      enum: [
        'document_uploaded',
        'version_created',
        'document_reviewed',
        'permission_granted',
        'rule_applied',
        'document_viewed',
      ],
      required: true,
    },
    description: { type: String, required: true },
    area: { type: String, default: 'Geral' },
    result: { type: String, enum: ['success', 'warning', 'error', 'info'], default: 'success' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditEventSchema.index({ tenantId: 1, createdAt: -1 });

export type AuditEventDoc = InferSchemaType<typeof auditEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditEventModel =
  mongoose.models.AuditEvent ?? mongoose.model('AuditEvent', auditEventSchema);
