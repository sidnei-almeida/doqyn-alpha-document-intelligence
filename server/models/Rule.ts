import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const ruleSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    documentType: { type: String, required: true },
    expectedFields: [{ type: String }],
    accessGroups: [{ type: String }],
    actions: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' },
  },
  { timestamps: true },
);

export type RuleDoc = InferSchemaType<typeof ruleSchema> & { _id: mongoose.Types.ObjectId };

export const RuleModel = mongoose.models.Rule ?? mongoose.model('Rule', ruleSchema);
