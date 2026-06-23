import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const processingJobSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    documentId: { type: String, required: true, index: true },
    versionId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
    },
    steps: [
      {
        name: String,
        status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'] },
        completedAt: Date,
      },
    ],
    error: { type: String },
  },
  { timestamps: true },
);

export type ProcessingJobDoc = InferSchemaType<typeof processingJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProcessingJobModel =
  mongoose.models.ProcessingJob ?? mongoose.model('ProcessingJob', processingJobSchema);
