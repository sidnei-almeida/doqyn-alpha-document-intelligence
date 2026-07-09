export type ExternalSharingTenantConfig = {
  externalSharingEnabled: boolean;
  defaultExternalShareExpirationDays: number;
  defaultCanDownload: boolean;
  requireEmailCode: boolean;
  defaultInviteExpirationDays: number;
};

const DEFAULT_EXTERNAL_SHARING_CONFIG: ExternalSharingTenantConfig = {
  externalSharingEnabled: process.env.APP_ENV !== 'production',
  defaultExternalShareExpirationDays: 7,
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
