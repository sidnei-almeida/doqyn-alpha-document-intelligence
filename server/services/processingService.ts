import { nanoid } from 'nanoid';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoProcessingJob } from '../db/types.js';
import { logger } from '../utils/logger.js';
import { buildDocumentOwnershipFilter } from '../tenancy/documentOwnership.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { withTenantFieldsFromContext } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';

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
  ownerUserId?: string;
}) {
  if (!input.tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }

  if (!isMongoNativeConfigured()) {
    logger.info('Job de processamento simulado', {
      tenantId: input.tenantId,
      documentId: input.documentId,
      versionId: input.versionId,
    });
    return { id: 'sim-job', status: 'in_progress' };
  }

  const { processingJobs, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });
  const jobId = `job_${nanoid(12)}`;
  const now = new Date();

  const job = withTenantFieldsFromContext(
    storage,
    {
    _id: jobId,
    documentId: input.documentId,
    versionId: input.versionId,
    type: 'legacy_upload',
    status: 'completed' as const,
    steps: PROCESSING_STEPS.map((name) => ({
      key: name,
      label: name,
      status: 'pending' as const,
      createdAt: now,
    })),
    error: null,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  },
    input.ownerUserId,
  );

  await processingJobs.insertOne(job as unknown as MongoProcessingJob);

  simulateProcessing(input.tenantId, jobId, input.ownerUserId).catch((error) => {
    logger.warn('Falha ao simular processamento', {
      tenantId: input.tenantId,
      jobId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  });

  return { id: jobId, status: 'processing' };
}

async function simulateProcessing(tenantId: string, jobId: string, ownerUserId?: string) {
  if (!isMongoNativeConfigured()) return;

  const { processingJobs, storage } = await getTenantCollections(tenantId, {
    userId: ownerUserId,
  });
  const ownershipFilter = buildDocumentOwnershipFilter(storage);

  for (let i = 0; i < PROCESSING_STEPS.length; i++) {
    await new Promise((r) => setTimeout(r, 500));
    await processingJobs.updateOne(
      { _id: jobId, ...ownershipFilter },
      {
        $set: {
          [`steps.${i}.status`]: 'completed',
          [`steps.${i}.completedAt`]: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  await processingJobs.updateOne(
    { _id: jobId, ...ownershipFilter },
    { $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date() } },
  );
}

export async function documentProcessingService(documentId: string) {
  logger.info('documentProcessingService invoked', { documentId });
  return { status: 'simulated', documentId };
}
