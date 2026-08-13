export type ExternalSharingTenantConfig = {
  externalSharingEnabled: boolean;
  defaultExternalShareExpirationDays: number;
  /**
   * Teto de validade de um link externo, em dias.
   *
   * Antes deste limite a criação só recusava data no passado, então um link de dez anos era aceito.
   * Como o acesso externo não é reavaliado depois de concedido — nem quando quem concedeu deixa a
   * empresa —, a validade é o único mecanismo que fecha o link sozinho, e sem teto ela podia ser
   * indefinida na prática.
   */
  maxExternalShareExpirationDays: number;
  defaultCanDownload: boolean;
  requireEmailCode: boolean;
  defaultInviteExpirationDays: number;
};

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const DEFAULT_EXTERNAL_SHARING_CONFIG: ExternalSharingTenantConfig = {
  externalSharingEnabled: process.env.APP_ENV !== 'production',
  defaultExternalShareExpirationDays: 7,
  maxExternalShareExpirationDays: readPositiveInt(
    process.env.EXTERNAL_SHARE_MAX_EXPIRATION_DAYS,
    90,
  ),
  defaultCanDownload: false,
  requireEmailCode: false,
  defaultInviteExpirationDays: 7,
};

export function resolveExternalSharingConfig(
  tenantSettings?: Partial<ExternalSharingTenantConfig>,
): ExternalSharingTenantConfig {
  return {
    ...DEFAULT_EXTERNAL_SHARING_CONFIG,
    ...(tenantSettings ?? {}),
    externalSharingEnabled:
      tenantSettings?.externalSharingEnabled ?? DEFAULT_EXTERNAL_SHARING_CONFIG.externalSharingEnabled,
  };
}
