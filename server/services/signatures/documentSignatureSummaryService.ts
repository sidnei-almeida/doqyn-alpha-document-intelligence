import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  MongoDocumentSignature,
  MongoDocumentSignatureRequest,
} from '../../db/types.js';
import type { Collection } from 'mongodb';

export type DocumentSignatureSummaryStatus =
  | 'none'
  | 'pending'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type DocumentSignatureSummarySigner = {
  name: string;
  signedAt: string;
};

export type DocumentSignatureSummary = {
  status: DocumentSignatureSummaryStatus;
  pendingCount: number;
  signedCount: number;
  signedSigners: DocumentSignatureSummarySigner[];
  latestRequestId?: string;
  latestSignatureId?: string;
  latestSignedAt?: string;
  latestSignerName?: string;
  hasSignedPdf: boolean;
  verificationCode?: string;
};

export const EMPTY_DOCUMENT_SIGNATURE_SUMMARY: DocumentSignatureSummary = {
  status: 'none',
  pendingCount: 0,
  signedCount: 0,
  signedSigners: [],
  hasSignedPdf: false,
};

const STATUS_PRIORITY: Record<DocumentSignatureSummaryStatus, number> = {
  pending: 5,
  signed: 4,
  declined: 3,
  expired: 2,
  cancelled: 1,
  none: 0,
};

async function getSignatureRequestsCollection(): Promise<
  Collection<MongoDocumentSignatureRequest>
> {
  const db = await getDb();
  return db.collection<MongoDocumentSignatureRequest>(
    SHARED_APP_COLLECTIONS.documentSignatureRequests,
  );
}

async function getSignaturesCollection(): Promise<Collection<MongoDocumentSignature>> {
  const db = await getDb();
  return db.collection<MongoDocumentSignature>(SHARED_APP_COLLECTIONS.documentSignatures);
}

function isRequestExpired(request: MongoDocumentSignatureRequest, now = Date.now()): boolean {
  return Boolean(request.expiresAt && request.expiresAt.getTime() <= now);
}

function resolveRequestSummaryStatus(
  request: MongoDocumentSignatureRequest,
  now = Date.now(),
): DocumentSignatureSummaryStatus {
  if (request.status === 'cancelled') return 'cancelled';
  if (request.status === 'declined') return 'declined';
  if (request.status === 'signed') return 'signed';
  if (request.status === 'partially_signed') return 'pending';
  if (request.status === 'expired' || (request.status === 'pending' && isRequestExpired(request, now))) {
    return 'expired';
  }
  if (request.status === 'pending') return 'pending';
  return 'none';
}

export function buildSignatureSummaryFromRequests(
  requests: MongoDocumentSignatureRequest[],
  signatures: MongoDocumentSignature[],
): DocumentSignatureSummary {
  if (requests.length === 0) {
    return { ...EMPTY_DOCUMENT_SIGNATURE_SUMMARY };
  }

  const signaturesByRequest = new Map(
    signatures.map((signature) => [signature.signatureRequestId, signature]),
  );
  const now = Date.now();

  let pendingCount = 0;
  let signedCount = 0;
  let aggregateStatus: DocumentSignatureSummaryStatus = 'none';

  for (const request of requests) {
    const bucket = resolveRequestSummaryStatus(request, now);
    if (bucket === 'pending') pendingCount += 1;
    if (bucket === 'signed' || signaturesByRequest.has(request.signatureRequestId)) {
      signedCount += 1;
    }
    if (STATUS_PRIORITY[bucket] > STATUS_PRIORITY[aggregateStatus]) {
      aggregateStatus = bucket;
    }
  }

  const sortedRequests = [...requests].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
  const latestRequest = sortedRequests[0];
  const latestSignature =
    signaturesByRequest.get(latestRequest.signatureRequestId) ??
    [...signatures].sort((left, right) => right.signedAt.getTime() - left.signedAt.getTime())[0];
  const signer = latestRequest.signers[0];
  const signedSigners = [...signatures]
    .filter((entry) => entry.status === 'signed')
    .sort((left, right) => left.signedAt.getTime() - right.signedAt.getTime())
    .map((entry) => ({
      name: entry.signerName,
      signedAt: entry.signedAt.toISOString(),
    }));

  return {
    status: aggregateStatus,
    pendingCount,
    signedCount,
    signedSigners,
    latestRequestId: latestRequest.signatureRequestId,
    latestSignatureId: latestSignature?.signatureId,
    latestSignedAt: latestSignature?.signedAt.toISOString(),
    latestSignerName: signer?.name,
    hasSignedPdf: Boolean(
      latestSignature?.signedPdfR2Key && latestSignature.status === 'signed',
    ),
    verificationCode: latestSignature?.verificationCode,
  };
}

export async function loadSignatureSummariesForDocuments(
  tenantId: string,
  documentIds: string[],
): Promise<Map<string, DocumentSignatureSummary>> {
  const summaries = new Map<string, DocumentSignatureSummary>();
  for (const documentId of documentIds) {
    summaries.set(documentId, { ...EMPTY_DOCUMENT_SIGNATURE_SUMMARY });
  }

  if (!documentIds.length || !isMongoNativeConfigured()) {
    return summaries;
  }

  const requestsCollection = await getSignatureRequestsCollection();
  const requests = await requestsCollection
    .find({ tenantId: tenantId, documentId: { $in: documentIds } })
    .sort({ createdAt: -1 })
    .toArray();

  if (requests.length === 0) {
    return summaries;
  }

  const signaturesCollection = await getSignaturesCollection();
  const signatures = await signaturesCollection
    .find({
      documentId: { $in: documentIds },
      signatureRequestId: { $in: requests.map((request) => request.signatureRequestId) },
    })
    .toArray();

  const requestsByDocument = new Map<string, MongoDocumentSignatureRequest[]>();
  for (const request of requests) {
    const bucket = requestsByDocument.get(request.documentId) ?? [];
    bucket.push(request);
    requestsByDocument.set(request.documentId, bucket);
  }

  const signaturesByDocument = new Map<string, MongoDocumentSignature[]>();
  for (const signature of signatures) {
    const bucket = signaturesByDocument.get(signature.documentId) ?? [];
    bucket.push(signature);
    signaturesByDocument.set(signature.documentId, bucket);
  }

  for (const documentId of documentIds) {
    summaries.set(
      documentId,
      buildSignatureSummaryFromRequests(
        requestsByDocument.get(documentId) ?? [],
        signaturesByDocument.get(documentId) ?? [],
      ),
    );
  }

  return summaries;
}

export async function loadDocumentSignatureSummary(
  tenantId: string,
  documentId: string,
): Promise<DocumentSignatureSummary> {
  const summaries = await loadSignatureSummariesForDocuments(tenantId, [documentId]);
  return summaries.get(documentId) ?? { ...EMPTY_DOCUMENT_SIGNATURE_SUMMARY };
}
