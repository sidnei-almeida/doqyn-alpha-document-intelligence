export type SettingsSectionId =
  | 'perfil'
  | 'preferencias'
  | 'upload-ia'
  | 'seguranca'
  | 'autenticacao'
  | 'organizacao'
  | 'sistema';

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: string;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'perfil',
    label: 'Perfil',
    description: 'Conta, foto e identidade',
    icon: 'person',
  },
  {
    id: 'preferencias',
    label: 'Preferências',
    description: 'Tema e experiência',
    icon: 'tune',
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
    id: 'autenticacao',
    label: 'Autenticação',
    description: 'Sessão e credenciais',
    icon: 'key',
  },
  {
    id: 'organizacao',
    label: 'Organização',
    description: 'Categorias e governança',
    icon: 'business',
  },
  {
    id: 'sistema',
    label: 'Sistema',
    description: 'Ambiente e integrações',
    icon: 'computer',
  },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'perfil';

const VALID_SECTIONS = new Set<string>(SETTINGS_NAV_ITEMS.map((item) => item.id));

export function parseSettingsSection(value: string | null): SettingsSectionId {
  if (value && VALID_SECTIONS.has(value)) {
    return value as SettingsSectionId;
  }
  return DEFAULT_SETTINGS_SECTION;
}

export function isSettingsSection(value: string): value is SettingsSectionId {
  return VALID_SECTIONS.has(value);
}

export function settingsSectionMeta(section: SettingsSectionId): SettingsNavItem {
  return SETTINGS_NAV_ITEMS.find((item) => item.id === section) ?? SETTINGS_NAV_ITEMS[0]!;
}
