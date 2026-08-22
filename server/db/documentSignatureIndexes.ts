import type { IndexDescription } from 'mongodb';
import { SHARED_APP_COLLECTIONS } from './constants.js';
import { ensureIndexesForCollection } from './tenantIndexes.js';

export const DOCUMENT_SIGNATURE_REQUESTS_INDEXES: IndexDescription[] = [
  { key: { signatureRequestId: 1 }, unique: true },
  { key: { documentId: 1, status: 1, createdAt: -1 } },
  { key: { tenantId: 1, status: 1 } },
  { key: { signatureTokenHash: 1 }, unique: true, sparse: true },
  { key: { 'signers.userId': 1, status: 1, createdAt: -1 } },
  { key: { 'signers.emailNormalized': 1, status: 1 } },
];

export const DOCUMENT_SIGNATURES_INDEXES: IndexDescription[] = [
  { key: { signatureId: 1 }, unique: true },
  { key: { signatureRequestId: 1 }, unique: true },
  { key: { documentId: 1, versionId: 1 } },
  { key: { verificationCode: 1 }, unique: true },
  { key: { signerEmailHash: 1, signedAt: -1 } },
];

export async function ensureDocumentSignatureRequestsIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentSignatureRequests,
    DOCUMENT_SIGNATURE_REQUESTS_INDEXES,
  );
}

export async function ensureDocumentSignaturesIndexes() {
  return ensureIndexesForCollection(
    SHARED_APP_COLLECTIONS.documentSignatures,
    DOCUMENT_SIGNATURES_INDEXES,
  );
}
