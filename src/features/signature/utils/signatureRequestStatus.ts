import type { DocumentSignatureRequestEntry } from '@/features/signature/api/signatureApi';

export function isSignatureRequestEntryOpen(entry: DocumentSignatureRequestEntry): boolean {
  if (entry.status === 'cancelled' || entry.status === 'declined' || entry.status === 'signed') {
    return false;
  }
  if (entry.status === 'expired') return false;
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return false;
  return entry.status === 'pending' || entry.status === 'partially_signed';
}

export function canRevokeSignatureRequestEntry(entry: DocumentSignatureRequestEntry): boolean {
  return isSignatureRequestEntryOpen(entry);
}
