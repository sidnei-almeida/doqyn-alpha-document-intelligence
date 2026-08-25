/**
 * Configurações agrupadas por quem decide, não por assunto.
 *
 * - Minha conta: o que a própria pessoa muda, sem depender de papel.
 * - Organização: o que vale para todo mundo — quem não administra lê e não altera.
 */
export type SettingsSectionId = 'conta' | 'organizacao';

/** Quem é dono da decisão daquela seção. */
export type SettingsSectionScope = 'personal' | 'organization';

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: string;
  scope: SettingsSectionScope;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'conta',
    label: 'Minha conta',
    description: 'Identidade, aparência e acesso',
    icon: 'person',
    scope: 'personal',
  },
  {
    id: 'organizacao',
    label: 'Organização',
    description: 'Envio, retenção e governança',
    icon: 'business',
    scope: 'organization',
  },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'conta';

/**
 * URLs antigas (quatro seções, sub-abas de Empresa) continuam abrindo em algum lugar certo.
 * O parâmetro `?tab=` deixou de existir: cada seção é uma tela só.
 */
const LEGACY_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  perfil: 'conta',
  preferencias: 'conta',
  autenticacao: 'conta',
  'upload-ia': 'organizacao',
  empresa: 'organizacao',
  organizacao: 'organizacao',
  lixeira: 'organizacao',
  seguranca: 'conta',
  sistema: 'conta',
};

const VALID_SECTIONS = new Set<string>(SETTINGS_NAV_ITEMS.map((item) => item.id));

export function isSettingsSection(value: string): value is SettingsSectionId {
  return VALID_SECTIONS.has(value);
}

export function parseSettingsSection(value: string | null): SettingsSectionId {
  if (!value) return DEFAULT_SETTINGS_SECTION;
  if (isSettingsSection(value)) return value;
  return LEGACY_SECTION_ALIASES[value] ?? DEFAULT_SETTINGS_SECTION;
}

export function settingsSectionMeta(section: SettingsSectionId): SettingsNavItem {
  return SETTINGS_NAV_ITEMS.find((item) => item.id === section) ?? SETTINGS_NAV_ITEMS[0]!;
}

export type SettingsAccess = {
  /** `individual` = pessoa física: não há hierarquia a aplicar, o dono vê tudo. */
  tenantType: string | null | undefined;
  isCompanyAdmin: boolean;
};

/** Em tenant PF o dono decide sozinho; em PJ, o que é da organização exige administrador. */
export function governsOrganization({ tenantType, isCompanyAdmin }: SettingsAccess): boolean {
  return tenantType === 'individual' || isCompanyAdmin;
}

/**
 * As duas seções aparecem para todo mundo. Organização é onde a pessoa descobre por que a IA
 * renomeou o arquivo dela; só quem administra vê os blocos que configuram a empresa.
 */
export function canViewSettingsSection(): boolean {
  return true;
}

export function visibleSettingsNavItems(): SettingsNavItem[] {
  return SETTINGS_NAV_ITEMS;
}

export function buildSettingsSearchParams(section: SettingsSectionId) {
  const params = new URLSearchParams();
  if (section !== DEFAULT_SETTINGS_SECTION) {
    params.set('section', section);
  }
  return params;
}
