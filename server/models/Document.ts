import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const documentSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    originalFileName: { type: String, required: true },
    displayName: { type: String, required: true },
    documentType: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'processed',
        'analyzing',
        'updated',
        'pending_review',
        'needs_review',
        'available',
        'pending_analysis',
        'update_processed',
        'review_required',
      ],
      default: 'analyzing',
    },
    version: { type: Number, default: 1 },
    currentVersionId: { type: String },
    ownerUserId: { type: String, required: true },
    ownerName: { type: String, required: true },
    area: { type: String, default: 'Geral' },
    accessGroups: [{ type: String }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    processingStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

documentSchema.index({ tenantId: 1, status: 1 });
documentSchema.index({ displayName: 'text', documentType: 'text' });

export type DocumentDoc = InferSchemaType<typeof documentSchema> & { _id: mongoose.Types.ObjectId };

export const DocumentModel =
  mongoose.models.Document ?? mongoose.model('Document', documentSchema);
