import { connectMongo } from '../db/mongo.js';
import { ProcessingJobModel } from '../models/ProcessingJob.js';
import { logger } from '../utils/logger.js';

const PROCESSING_STEPS = [
  'upload_received',
  'document_analysis',
  'classification_metadata',
  'available_with_traceability',
];

export async function createProcessingJob(input: {
  tenantId: string;
  documentId: string;
  versionId: string;
}) {
  await connectMongo();

  if (!process.env.MONGODB_URI) {
    logger.info('Job de processamento simulado', input);
    return { id: 'sim-job', status: 'in_progress' };
  }

  const job = await ProcessingJobModel.create({
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionId: input.versionId,
    status: 'in_progress',
    steps: PROCESSING_STEPS.map((name) => ({ name, status: 'pending' })),
  });

  // Future: dispatch to Google Document AI / Cloud Vision
  simulateProcessing(job._id.toString());

  return { id: job._id.toString(), status: job.status };
}

async function simulateProcessing(jobId: string) {
  if (!process.env.MONGODB_URI) return;

  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 500));
    await ProcessingJobModel.findByIdAndUpdate(jobId, {
      $set: { [`steps.${i}.status`]: 'completed', [`steps.${i}.completedAt`]: new Date() },
    });
  }

  await ProcessingJobModel.findByIdAndUpdate(jobId, { status: 'completed' });
}

export async function documentProcessingService(documentId: string) {
  logger.info('documentProcessingService invoked', { documentId });
  // Future: Google Document AI integration point
  return { status: 'simulated', documentId };
}
