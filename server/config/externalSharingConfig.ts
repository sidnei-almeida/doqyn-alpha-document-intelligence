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

/**
 * O portão do compartilhamento externo.
 *
 * O default por ambiente — ligado fora de produção, desligado dentro — nasceu como freio
 * enquanto o fluxo não estava pronto, mas não tinha chave de saída: em produção era
 * `403 EXTERNAL_SHARING_DISABLED` e ponto, sem variável que ligasse. E como o modal de
 * assinatura passa por aqui para dar acesso ao signatário de fora, o portão fechado levava
 * junto a assinatura externa.
 *
 * Ausente, o comportamento é exatamente o de antes. Só o valor explícito muda o default.
 */
function readExternalSharingEnabled(): boolean {
  const raw = process.env.EXTERNAL_SHARING_ENABLED?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.APP_ENV !== 'production';
}

// Lido a cada chamada, e não uma vez no import: congelado no carregamento do módulo, o valor
// dependia de quem importou primeiro, e nenhum teste conseguia exercitar os dois lados do portão.
function defaultExternalSharingConfig(): ExternalSharingTenantConfig {
  return {
    externalSharingEnabled: readExternalSharingEnabled(),
    defaultExternalShareExpirationDays: 7,
    maxExternalShareExpirationDays: readPositiveInt(
      process.env.EXTERNAL_SHARE_MAX_EXPIRATION_DAYS,
      90,
    ),
    defaultCanDownload: false,
    requireEmailCode: false,
    defaultInviteExpirationDays: 7,
  };
}

export function resolveExternalSharingConfig(
  tenantSettings?: Partial<ExternalSharingTenantConfig>,
): ExternalSharingTenantConfig {
  const defaults = defaultExternalSharingConfig();
  return {
    ...defaults,
    ...(tenantSettings ?? {}),
    externalSharingEnabled:
      tenantSettings?.externalSharingEnabled ?? defaults.externalSharingEnabled,
  };
}
