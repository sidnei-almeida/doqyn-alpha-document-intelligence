export type SettingsSectionId = 'perfil' | 'upload-ia' | 'seguranca' | 'empresa';

export type AccountSettingsTab = 'identidade' | 'preferencias' | 'acesso';
export type CompanySettingsTab = 'governanca' | 'retencao' | 'sistema';
export type SettingsTabId = AccountSettingsTab | CompanySettingsTab;

export type LegacySettingsSectionId =
  | 'preferencias'
  | 'autenticacao'
  | 'organizacao'
  | 'lixeira'
  | 'sistema';

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: string;
};

export type SettingsSubTabItem<T extends string = SettingsTabId> = {
  id: T;
  label: string;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'perfil',
    label: 'Perfil',
    description: 'Identidade, preferências e acesso',
    icon: 'person',
  },
  {
    id: 'upload-ia',
    label: 'Upload e IA',
    description: 'Revisão, nomeação e lote',
    icon: 'neurology',
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    description: 'Auditoria e conformidade',
    icon: 'shield',
  },
  {
    id: 'empresa',
    label: 'Empresa',
    description: 'Governança, retenção e sistema',
    icon: 'business',
  },
];

export const ACCOUNT_SETTINGS_TABS: SettingsSubTabItem<AccountSettingsTab>[] = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'preferencias', label: 'Preferências' },
  { id: 'acesso', label: 'Acesso' },
];

export const COMPANY_SETTINGS_TABS: SettingsSubTabItem<CompanySettingsTab>[] = [
  { id: 'governanca', label: 'Governança' },
  { id: 'retencao', label: 'Retenção' },
  { id: 'sistema', label: 'Sistema' },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'perfil';

export const LEGACY_SECTION_REDIRECTS: Record<
  LegacySettingsSectionId,
  { section: SettingsSectionId; tab: SettingsTabId }
> = {
  preferencias: { section: 'perfil', tab: 'preferencias' },
  autenticacao: { section: 'perfil', tab: 'acesso' },
  organizacao: { section: 'empresa', tab: 'governanca' },
  lixeira: { section: 'empresa', tab: 'retencao' },
  sistema: { section: 'empresa', tab: 'sistema' },
};

const VALID_SECTIONS = new Set<string>(SETTINGS_NAV_ITEMS.map((item) => item.id));
const ACCOUNT_TABS = new Set<string>(ACCOUNT_SETTINGS_TABS.map((item) => item.id));
const COMPANY_TABS = new Set<string>(COMPANY_SETTINGS_TABS.map((item) => item.id));

export function isLegacySettingsSection(value: string): value is LegacySettingsSectionId {
  return value in LEGACY_SECTION_REDIRECTS;
}

export function isAccountSettingsTab(value: string): value is AccountSettingsTab {
  return ACCOUNT_TABS.has(value);
}

export function isCompanySettingsTab(value: string): value is CompanySettingsTab {
  return COMPANY_TABS.has(value);
}

export function getDefaultTabForSection(section: SettingsSectionId): SettingsTabId | null {
  if (section === 'perfil') return 'identidade';
  if (section === 'empresa') return 'governanca';
  return null;
}

export function parseSettingsSection(value: string | null): SettingsSectionId {
  if (!value) {
    return DEFAULT_SETTINGS_SECTION;
  }
  if (isLegacySettingsSection(value)) {
    return LEGACY_SECTION_REDIRECTS[value].section;
  }
  if (VALID_SECTIONS.has(value)) {
    return value as SettingsSectionId;
  }
  return DEFAULT_SETTINGS_SECTION;
}

export function parseSettingsTab(
  section: SettingsSectionId,
  sectionParam: string | null,
  tabParam: string | null,
): SettingsTabId | null {
  if (sectionParam && isLegacySettingsSection(sectionParam)) {
    return LEGACY_SECTION_REDIRECTS[sectionParam].tab;
  }

  const defaultTab = getDefaultTabForSection(section);
  if (!defaultTab) {
    return null;
  }

  if (tabParam) {
    if (section === 'perfil' && isAccountSettingsTab(tabParam)) {
      return tabParam;
    }
    if (section === 'empresa' && isCompanySettingsTab(tabParam)) {
      return tabParam;
    }
  }

  return defaultTab;
}

export function isSettingsSection(value: string): value is SettingsSectionId {
  return VALID_SECTIONS.has(value);
}

export function settingsSectionMeta(section: SettingsSectionId): SettingsNavItem {
  return SETTINGS_NAV_ITEMS.find((item) => item.id === section) ?? SETTINGS_NAV_ITEMS[0]!;
}

export function buildSettingsSearchParams(section: SettingsSectionId, tab?: SettingsTabId | null) {
  const params = new URLSearchParams();
  const defaultTab = getDefaultTabForSection(section);

  if (section !== DEFAULT_SETTINGS_SECTION) {
    params.set('section', section);
  }

  if (tab && tab !== defaultTab) {
    params.set('tab', tab);
  }

  return params;
}
