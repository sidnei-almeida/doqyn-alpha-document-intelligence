import type { MongoDocumentSignatureRequest } from '../../db/types.js';

export type EffectiveSignatureRequestStatus =
  | MongoDocumentSignatureRequest['status']
  | 'expired';

export function isSignatureRequestExpired(
  request: Pick<MongoDocumentSignatureRequest, 'expiresAt'>,
  now = Date.now(),
): boolean {
  return Boolean(request.expiresAt && request.expiresAt.getTime() <= now);
}

export function resolveEffectiveSignatureRequestStatus(
  request: Pick<MongoDocumentSignatureRequest, 'status' | 'expiresAt'>,
  now = Date.now(),
): EffectiveSignatureRequestStatus {
  if (
    (request.status === 'pending' || request.status === 'partially_signed') &&
    isSignatureRequestExpired(request, now)
  ) {
    return 'expired';
  }
  return request.status;
}

export function isSignatureRequestOpen(
  request: Pick<MongoDocumentSignatureRequest, 'status' | 'expiresAt'>,
  now = Date.now(),
): boolean {
  if (
    request.status === 'cancelled' ||
    request.status === 'declined' ||
    request.status === 'signed'
  ) {
    return false;
  }
  if (isSignatureRequestExpired(request, now)) return false;
  return request.status === 'pending' || request.status === 'partially_signed';
}
