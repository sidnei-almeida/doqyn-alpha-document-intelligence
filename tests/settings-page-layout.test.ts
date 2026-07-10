import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('SettingsPage layout', () => {
  it('renderiza com PageShell e layout de duas colunas', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const layout = readSrc('features/settings/components/SettingsLayout.tsx');
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    assert.ok(page.includes('PageShell'));
    assert.ok(page.includes('SettingsLayout'));
    assert.ok(page.includes('settings-page'));
    assert.ok(page.includes('SETTINGS_UI_PATTERN.pageEyebrow'));
    assert.ok(page.includes('meta.label'));
    assert.ok(layout.includes('settings-shell'));
    assert.ok(layout.includes('settings-content-panel'));
    assert.equal(layout.includes('settings-content-panel__title'), false);
    assert.equal(layout.includes('Configurações da conta'), false);
    assert.equal(globals.includes('settings-content-max'), false);
    assert.equal(globals.includes('margin-inline: auto'), false);
    assert.equal(page.includes('max-w-2xl'), false);
  });

  it('padrão visual compartilha badge Ativo/Em breve e SettingsRow', () => {
    const pattern = readSrc('features/settings/settingsUiPattern.ts');
    const badge = readSrc('features/settings/components/SettingsStatusBadge.tsx');
    const row = readSrc('features/settings/components/SettingsRow.tsx');
    const info = readSrc('features/settings/components/SettingsInfoCard.tsx');
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    assert.ok(pattern.includes('Hierarquia de cabeçalho'));
    assert.ok(badge.includes("variant=\"success\""));
    assert.ok(badge.includes("variant=\"neutral\""));
    assert.ok(badge.includes('border-dashed'));
    assert.ok(badge.includes("from '@/components/ui/Badge'"));
    assert.ok(row.includes('settings-row'));
    assert.ok(info.includes('SettingsStatusBadge'));
    assert.ok(info.includes('featured'));
    assert.ok(globals.includes('settings-row-list'));
    assert.ok(globals.includes('border-style: dashed'));
    assert.ok(globals.includes('settings-info-card--featured'));
    assert.ok(globals.includes('settings-callout'));
    assert.ok(globals.includes('var(--accent-active)'));
  });

  it('menu interno lista quatro seções de configurações', () => {
    const nav = readSrc('features/settings/components/SettingsSidebarNav.tsx');
    const sections = readSrc('features/settings/settingsSections.ts');
    assert.ok(nav.includes('SETTINGS_NAV_ITEMS'));
    assert.ok(sections.includes("'perfil'"));
    assert.ok(sections.includes("'upload-ia'"));
    assert.ok(sections.includes("'seguranca'"));
    assert.ok(sections.includes("'empresa'"));
    assert.ok(sections.includes('ACCOUNT_SETTINGS_TABS'));
    assert.ok(sections.includes('COMPANY_SETTINGS_TABS'));
    assert.ok(sections.includes("id: 'perfil'"));
    assert.ok(sections.includes("id: 'upload-ia'"));
    assert.ok(sections.includes("id: 'seguranca'"));
    assert.ok(sections.includes("id: 'empresa'"));
    assert.equal(sections.includes("id: 'organizacao'"), false);
    assert.equal(sections.includes("id: 'lixeira'"), false);
    assert.equal(sections.includes("id: 'autenticacao'"), false);
  });

  it('Preferências usa linhas de configuração com tema segmentado', () => {
    const prefs = readSrc('features/settings/components/sections/PreferencesSettingsSection.tsx');
    assert.ok(prefs.includes('SettingsRow'));
    assert.ok(prefs.includes('setTheme'));
    assert.ok(prefs.includes("'Claro'"));
    assert.ok(prefs.includes("'Escuro'"));
    assert.ok(prefs.includes('LibraryViewPreview'));
    assert.ok(prefs.includes('Densidade visual'));
    assert.ok(prefs.includes('lock'));
    assert.ok(prefs.includes('muted'));
    assert.equal(prefs.includes('ThemeToggle'), false);
    assert.equal(prefs.includes('SettingsInfoCard'), false);
  });

  it('Perfil composto mostra identidade, preferências e acesso', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const account = readSrc('features/settings/components/sections/AccountSettingsSection.tsx');
    const profile = readSrc('features/settings/components/sections/ProfileSettingsSection.tsx');
    assert.ok(page.includes('AccountSettingsSection'));
    assert.ok(account.includes('ProfileSettingsSection'));
    assert.ok(account.includes('PreferencesSettingsSection'));
    assert.ok(account.includes('AuthenticationSettingsSection'));
    assert.ok(account.includes("'identidade'"));
    assert.ok(account.includes("'preferencias'"));
    assert.ok(account.includes("'acesso'"));
    assert.ok(profile.includes('UserAvatar'));
    assert.ok(profile.includes('Alterar foto'));
    assert.ok(profile.includes('settings-profile-avatar-trigger'));
    assert.ok(profile.includes('PlatformRoleChips'));
    assert.ok(profile.includes('Detalhes da conta'));
    assert.ok(profile.includes('photo_camera'));
  });

  it('clicar em Upload e IA mostra seção Upload e IA', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const upload = readSrc('features/settings/components/sections/UploadAiSettingsSection.tsx');
    const panel = readSrc('features/document-send/components/ReviewWorkflowSettingsPanel.tsx');
    assert.ok(page.includes("case 'upload-ia'"));
    assert.ok(upload.includes('ReviewWorkflowSettingsPanel'));
    assert.ok(upload.includes('useUploadQueueContext'));
    assert.ok(panel.includes('SettingsFieldGroup'));
    assert.ok(panel.includes('settings-workflow-panel'));
  });

  it('clicar em Segurança mostra seção Segurança', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const security = readSrc('features/settings/components/sections/SecuritySettingsSection.tsx');
    const info = readSrc('features/settings/components/SettingsInfoCard.tsx');
    assert.ok(page.includes("case 'seguranca'"));
    assert.ok(security.includes('SettingsInfoCard'));
    assert.ok(security.includes('/tracking'));
    assert.ok(security.includes('settings-summary-bar'));
    assert.ok(security.includes('settings-cards-grid--balanced'));
    assert.ok(security.includes('recursos de segurança ativos'));
    assert.ok(info.includes("status?: 'ok' | 'pending' | 'neutral'"));
    assert.ok(info.includes("linkLabel = 'Abrir'"));
    assert.ok(info.includes('settings-info-card__action'));
  });

  it('Empresa composto mostra governança, retenção e sistema', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const company = readSrc('features/settings/components/sections/CompanySettingsSection.tsx');
    const org = readSrc('features/settings/components/sections/OrganizationSettingsSection.tsx');
    const system = readSrc('features/settings/components/sections/SystemSettingsSection.tsx');
    assert.ok(page.includes('CompanySettingsSection'));
    assert.ok(company.includes('OrganizationSettingsSection'));
    assert.ok(company.includes('TrashRetentionSettingsSection'));
    assert.ok(company.includes('SystemSettingsSection'));
    assert.ok(company.includes("'governanca'"));
    assert.ok(company.includes("'retencao'"));
    assert.ok(company.includes("'sistema'"));
    assert.ok(company.includes('canManageRetention'));
    assert.ok(org.includes('settings-cards-grid--2col'));
    assert.ok(org.includes('featured'));
    assert.ok(org.includes('settings-callout'));
    assert.ok(org.includes('/rules'));
    assert.ok(org.includes('Abrir Regras'));
    assert.ok(org.includes('/users'));
    assert.ok(org.includes('Gerenciar usuários'));
    assert.ok(system.includes('Sobre o sistema'));
    assert.ok(system.includes('settings-system-overview'));
    assert.ok(system.includes('Ver detalhes avançados'));
    assert.ok(system.includes('settings-cards-grid--3col'));
    assert.ok(system.includes("status=\"ok\""));
    assert.ok(system.includes("status=\"pending\""));
    assert.ok(system.includes('APP_NAME'));
    assert.ok(system.includes('import.meta.env.MODE'));
  });

  it('Autenticação permanece acessível na aba Acesso do perfil', () => {
    const account = readSrc('features/settings/components/sections/AccountSettingsSection.tsx');
    const auth = readSrc('features/settings/components/sections/AuthenticationSettingsSection.tsx');
    assert.ok(account.includes('AuthenticationSettingsSection'));
    assert.ok(auth.includes('usesDoqynAuth'));
    assert.ok(auth.includes('PasswordChangeCard'));
    assert.ok(auth.includes('Ver detalhes técnicos'));
    assert.ok(auth.includes('settings-locked-option'));
    assert.ok(auth.includes('Sessões ativas'));
  });

  it('alterar senha fica sempre visível na autenticação', () => {
    const card = readSrc('features/settings/components/PasswordChangeCard.tsx');
    const form = readSrc('features/settings/components/ChangePasswordForm.tsx');
    assert.ok(card.includes('SettingsFieldGroup'));
    assert.ok(card.includes('ChangePasswordForm'));
    assert.equal(card.includes('useState(false)'), false);
    assert.equal(card.includes('aria-expanded'), false);
    assert.ok(form.includes('revealable'));
    assert.ok(form.includes('settings-password-checklist'));
    assert.ok(form.includes('settings-password-strength'));
  });

  it('upload/IA inline usa Checkbox e Radio do design system', () => {
    const panel = readSrc('features/document-send/components/ReviewWorkflowSettingsPanel.tsx');
    assert.ok(panel.includes("from '@/components/ui/Checkbox'"));
    assert.ok(panel.includes("from '@/components/ui/Radio'"));
    assert.equal(panel.includes('settings-toggle-row__input'), false);
    assert.equal(panel.includes('settings-choice-item__input'), false);
  });

  it('header do usuário aponta só para configurações da conta', () => {
    const menu = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(menu.includes('Configurações da conta'));
    assert.equal(menu.includes('ProfileSettingsDialog'), false);
    assert.equal(menu.includes('Configurações de perfil'), false);
    assert.equal(menu.includes('>Perfil<'), false);
  });

  it('nenhuma configuração crítica some do app', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const account = readSrc('features/settings/components/sections/AccountSettingsSection.tsx');
    const company = readSrc('features/settings/components/sections/CompanySettingsSection.tsx');
    const legacy = readSrc('features/documents/SettingsPage.tsx');
    assert.ok(page.includes('UploadAiSettingsSection'));
    assert.ok(account.includes('AuthenticationSettingsSection'));
    assert.ok(company.includes('TrashRetentionSettingsSection'));
    assert.ok(legacy.includes("from '@/features/settings/SettingsPage'"));
  });

  it('layout não quebra sem dados de avatar', () => {
    const profile = readSrc('features/settings/components/sections/ProfileSettingsSection.tsx');
    assert.ok(profile.includes('user?.name'));
    assert.ok(profile.includes('avatarUrl={displayAvatarUrl}'));
  });

  it('estado por URL section e tab funciona com redirects legados', () => {
    const hook = readSrc('features/settings/hooks/useSettingsSection.ts');
    const sections = readSrc('features/settings/settingsSections.ts');
    assert.ok(hook.includes("searchParams.get('section')"));
    assert.ok(hook.includes("searchParams.get('tab')"));
    assert.ok(hook.includes('parseSettingsSection'));
    assert.ok(hook.includes('parseSettingsTab'));
    assert.ok(hook.includes('LEGACY_SECTION_REDIRECTS'));
    assert.ok(sections.includes('upload-ia'));
    assert.ok(sections.includes('LEGACY_SECTION_REDIRECTS'));
    assert.ok(hook.includes("hash === 'upload'"));
    assert.ok(hook.includes("setSection('upload-ia')"));
    assert.ok(sections.includes("preferencias: { section: 'perfil', tab: 'preferencias' }"));
    assert.ok(sections.includes("lixeira: { section: 'empresa', tab: 'retencao' }"));
  });
});
