/**
 * Configurações agrupadas por quem decide, não por assunto.
 *
 * - Minha conta: o que a própria pessoa muda, sem depender de papel.
 * - Organização (PJ) / Meu acervo (PF): o que vale para o tenant inteiro — quem não administra
 *   lê e não altera.
 */
import { isIndividualTenant, tenantVocabulary } from '@/lib/tenantVocabulary';
export type SettingsSectionId = 'conta' | 'organizacao';

/** Quem é dono da decisão daquela seção. */
export type SettingsSectionScope = 'personal' | 'organization';

export type SettingsNavItem = {
  id: SettingsSectionId;
  /** Chave, não frase: a lista é constante de módulo e o idioma muda em tempo de execução. */
  labelKey: string;
  descriptionKey: string;
  icon: string;
  scope: SettingsSectionScope;
};

/**
 * O rótulo da segunda seção depende do tipo de tenant: em PF não há organização alguma, e
 * chamar de "Organização" o lugar onde a pessoa configura o próprio acervo prometia uma
 * estrutura que não existe. O resto — ícone, ordem, descrição — não muda.
 */
export function settingsNavItems(tenantType?: string | null): SettingsNavItem[] {
  const vocabulary = tenantVocabulary(tenantType);

  return [
    {
      id: 'conta',
      labelKey: 'settings:nav.contaLabel',
      descriptionKey: 'settings:nav.contaDescription',
      icon: 'person',
      scope: 'personal',
    },
    {
      id: 'organizacao',
      labelKey: vocabulary.scopeSectionLabelKey,
      descriptionKey: 'settings:nav.organizacaoDescription',
      icon: isIndividualTenant(tenantType) ? 'inventory_2' : 'business',
      scope: 'organization',
    },
  ];
}

/** Forma PJ, preservada para quem só precisa dos ids/ordem sem contexto de sessão. */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = settingsNavItems('business');

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

export function settingsSectionMeta(
  section: SettingsSectionId,
  tenantType?: string | null,
): SettingsNavItem {
  const items = settingsNavItems(tenantType);
  return items.find((item) => item.id === section) ?? items[0]!;
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
 * As duas seções aparecem para todo mundo. A segunda é onde a pessoa descobre por que a IA
 * renomeou o arquivo dela; só quem administra vê os blocos que configuram o tenant.
 */
export function canViewSettingsSection(): boolean {
  return true;
}

export function visibleSettingsNavItems(tenantType?: string | null): SettingsNavItem[] {
  return settingsNavItems(tenantType);
}

export function buildSettingsSearchParams(section: SettingsSectionId) {
  const params = new URLSearchParams();
  if (section !== DEFAULT_SETTINGS_SECTION) {
    params.set('section', section);
  }
  return params;
}
