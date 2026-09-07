/**
 * Política de upload/IA do tenant — fonte única do formato entre front e servidor.
 *
 * Antes vivia só no localStorage do navegador (`doqyn.upload.reviewSettings`), o que fazia
 * cada máquina ter a sua regra de nomeação. Agora é configuração de tenant, persistida em
 * `tenants.settings.uploadPolicy`, como já era a retenção de lixeira.
 */

export type UploadNamingPolicy = 'original' | 'ai_suggested' | 'ask_each_file' | 'manual_required';

export type TenantUploadPolicy = {
  autoReviewEnabled: boolean;
  autoAcceptDelaySeconds: number;
  pauseOnLowConfidence: boolean;
  pauseOnMissingFields: boolean;
  pauseOnSensitiveDocs: boolean;

  defaultNamingPolicy: UploadNamingPolicy;
  aiRenameEnabled: boolean;

  aiMetadataEnabled: boolean;
  aiClassificationEnabled: boolean;
  preventSensitiveDataInFileName: boolean;

  applyToBatch: boolean;
  pauseOnConflict: boolean;
  continueWhenSafe: boolean;
};

export const UPLOAD_AUTO_DELAY_SECONDS_MIN = 0;
export const UPLOAD_AUTO_DELAY_SECONDS_MAX = 30;
export const UPLOAD_AUTO_DELAY_SECONDS_DEFAULT = 10;

export const DEFAULT_TENANT_UPLOAD_POLICY: TenantUploadPolicy = {
  autoReviewEnabled: false,
  autoAcceptDelaySeconds: UPLOAD_AUTO_DELAY_SECONDS_DEFAULT,
  pauseOnLowConfidence: true,
  pauseOnMissingFields: true,
  pauseOnSensitiveDocs: false,

  defaultNamingPolicy: 'ai_suggested',
  aiRenameEnabled: true,

  aiMetadataEnabled: true,
  aiClassificationEnabled: true,
  preventSensitiveDataInFileName: true,

  applyToBatch: false,
  pauseOnConflict: true,
  continueWhenSafe: true,
};

const NAMING_POLICIES: readonly UploadNamingPolicy[] = [
  'original',
  'ai_suggested',
  'ask_each_file',
  'manual_required',
];

export function isUploadNamingPolicy(value: unknown): value is UploadNamingPolicy {
  return typeof value === 'string' && (NAMING_POLICIES as readonly string[]).includes(value);
}

export function clampUploadAutoDelaySeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return UPLOAD_AUTO_DELAY_SECONDS_DEFAULT;
  }
  return Math.min(
    UPLOAD_AUTO_DELAY_SECONDS_MAX,
    Math.max(UPLOAD_AUTO_DELAY_SECONDS_MIN, Math.round(value)),
  );
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Aceita entrada parcial/desconhecida (body de request, documento antigo) e devolve política válida. */
export function normalizeTenantUploadPolicy(
  input?: Partial<TenantUploadPolicy> | null,
): TenantUploadPolicy {
  const base = DEFAULT_TENANT_UPLOAD_POLICY;
  const raw = (input ?? {}) as Partial<TenantUploadPolicy>;

  return {
    autoReviewEnabled: pickBoolean(raw.autoReviewEnabled, base.autoReviewEnabled),
    autoAcceptDelaySeconds: clampUploadAutoDelaySeconds(
      typeof raw.autoAcceptDelaySeconds === 'number'
        ? raw.autoAcceptDelaySeconds
        : base.autoAcceptDelaySeconds,
    ),
    pauseOnLowConfidence: pickBoolean(raw.pauseOnLowConfidence, base.pauseOnLowConfidence),
    pauseOnMissingFields: pickBoolean(raw.pauseOnMissingFields, base.pauseOnMissingFields),
    pauseOnSensitiveDocs: pickBoolean(raw.pauseOnSensitiveDocs, base.pauseOnSensitiveDocs),

    defaultNamingPolicy: isUploadNamingPolicy(raw.defaultNamingPolicy)
      ? raw.defaultNamingPolicy
      : base.defaultNamingPolicy,
    aiRenameEnabled: pickBoolean(raw.aiRenameEnabled, base.aiRenameEnabled),

    aiMetadataEnabled: pickBoolean(raw.aiMetadataEnabled, base.aiMetadataEnabled),
    aiClassificationEnabled: pickBoolean(raw.aiClassificationEnabled, base.aiClassificationEnabled),
    preventSensitiveDataInFileName: pickBoolean(
      raw.preventSensitiveDataInFileName,
      base.preventSensitiveDataInFileName,
    ),

    applyToBatch: pickBoolean(raw.applyToBatch, base.applyToBatch),
    pauseOnConflict: pickBoolean(raw.pauseOnConflict, base.pauseOnConflict),
    continueWhenSafe: pickBoolean(raw.continueWhenSafe, base.continueWhenSafe),
  };
}
