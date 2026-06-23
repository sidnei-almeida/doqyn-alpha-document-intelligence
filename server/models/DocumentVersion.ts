import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const documentVersionSchema = new Schema(
  {
    documentId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    originalFileName: { type: String, required: true },
    displayName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    hash: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    changeNotes: { type: String },
    status: { type: String, default: 'pending_analysis' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    storageRef: { type: String },
  },
  { timestamps: false },
);

documentVersionSchema.index({ documentId: 1, version: -1 });

export type DocumentVersionDoc = InferSchemaType<typeof documentVersionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentVersionModel =
  mongoose.models.DocumentVersion ?? mongoose.model('DocumentVersion', documentVersionSchema);
