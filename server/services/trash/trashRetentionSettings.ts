import { REGISTRY_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { MongoTenant, MongoTenantTrashSettings, TrashRetentionMode } from '../../db/types.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { invalidateTenantRegistryCache } from '../../tenancy/tenantRegistryCache.js';

export const DEFAULT_TRASH_RETENTION_DAYS = 30;
export const MIN_TRASH_RETENTION_DAYS = 1;
export const MAX_TRASH_RETENTION_DAYS = 365;

export const DEFAULT_TRASH_SETTINGS: MongoTenantTrashSettings = {
  trashRetentionMode: 'days',
  trashRetentionDays: DEFAULT_TRASH_RETENTION_DAYS,
};

function clampRetentionDays(days: number): number {
  return Math.min(MAX_TRASH_RETENTION_DAYS, Math.max(MIN_TRASH_RETENTION_DAYS, Math.round(days)));
}

export function normalizeTrashSettings(
  input?: Partial<MongoTenantTrashSettings> | null,
): MongoTenantTrashSettings {
  const mode: TrashRetentionMode = input?.trashRetentionMode === 'manual' ? 'manual' : 'days';
  const days = clampRetentionDays(input?.trashRetentionDays ?? DEFAULT_TRASH_RETENTION_DAYS);
  return {
    trashRetentionMode: mode,
    trashRetentionDays: days,
  };
}

export function computeTrashExpiresAt(
  settings: MongoTenantTrashSettings,
  from: Date = new Date(),
): Date | null {
  if (settings.trashRetentionMode === 'manual') {
    return null;
  }
  const expires = new Date(from);
  expires.setDate(expires.getDate() + settings.trashRetentionDays);
  return expires;
}

export async function getTrashRetentionSettings(
  tenantId: string,
): Promise<MongoTenantTrashSettings> {
  if (!isMongoNativeConfigured()) {
    return { ...DEFAULT_TRASH_SETTINGS };
  }

  const db = await getDb();
  const tenant = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).findOne({
    tenantId,
  });

  return normalizeTrashSettings(tenant?.settings?.trash);
}

export async function updateTrashRetentionSettings(
  tenantId: string,
  patch: Partial<MongoTenantTrashSettings>,
): Promise<MongoTenantTrashSettings> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('MongoDB não configurado.', 'MONGO_NOT_CONFIGURED', 503);
  }

  const current = await getTrashRetentionSettings(tenantId);
  const next = normalizeTrashSettings({ ...current, ...patch });
  const now = new Date();

  const db = await getDb();
  const result = await db.collection<MongoTenant>(REGISTRY_COLLECTIONS.tenants).updateOne(
    { tenantId },
    {
      $set: {
        'settings.trash': next,
        updatedAt: now,
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new ServiceError('Tenant não encontrado.', 'TENANT_NOT_FOUND', 404);
  }

  await invalidateTenantRegistryCache(tenantId);

  return next;
}
