import type { VercelRequest } from '@vercel/node';
import type { AuthUser } from '../auth/types.js';
import { canViewDocumentTracking } from '../auth/permissions.js';
import {
  requireDocumentAuthContext,
  type DocumentAuthContext,
} from '../tenancy/documentRequestContext.js';
import { ServiceError } from '../utils/serviceErrors.js';

export async function requireDocumentTrackingAccess(
  req: VercelRequest,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<DocumentAuthContext | null> {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return null;

  if (!canViewDocumentTracking(auth.user)) {
    res.status(403).json({
      message: 'Você não tem permissão para visualizar o tracking documental desta organização.',
      code: 'TRACKING_FORBIDDEN',
    });
    return null;
  }

  return auth;
}

export function assertTrackingAccess(user: AuthUser): void {
  if (!canViewDocumentTracking(user)) {
    throw new ServiceError(
      'Você não tem permissão para visualizar o tracking documental desta organização.',
      'TRACKING_FORBIDDEN',
      403,
    );
  }
}
