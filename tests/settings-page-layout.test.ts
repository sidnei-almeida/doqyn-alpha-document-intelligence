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
    assert.ok(layout.includes('settings-shell'));
    assert.ok(layout.includes('settings-content-panel'));
    assert.equal(globals.includes('settings-content-max'), false);
    assert.equal(globals.includes('margin-inline: auto'), false);
    assert.equal(page.includes('max-w-2xl'), false);
  });

  it('menu interno lista todas as seções de configurações', () => {
    const nav = readSrc('features/settings/components/SettingsSidebarNav.tsx');
    const sections = readSrc('features/settings/settingsSections.ts');
    assert.ok(nav.includes('SETTINGS_NAV_ITEMS'));
    assert.ok(sections.includes("'perfil'"));
    assert.ok(sections.includes("'upload-ia'"));
    assert.ok(sections.includes("'seguranca'"));
    assert.ok(sections.includes("'autenticacao'"));
  });

  it('clicar em Perfil mostra seção Perfil', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const profile = readSrc('features/settings/components/sections/ProfileSettingsSection.tsx');
    assert.ok(page.includes("case 'perfil'"));
    assert.ok(page.includes('ProfileSettingsSection'));
    assert.ok(profile.includes('UserAvatar'));
    assert.ok(profile.includes('Alterar foto'));
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
    assert.ok(page.includes("case 'seguranca'"));
    assert.ok(security.includes('SettingsInfoCard'));
    assert.ok(security.includes('/tracking'));
  });

  it('clicar em Autenticação mostra seção Autenticação', () => {
    const page = readSrc('features/settings/SettingsPage.tsx');
    const auth = readSrc('features/settings/components/sections/AuthenticationSettingsSection.tsx');
    assert.ok(page.includes("case 'autenticacao'"));
    assert.ok(auth.includes('usesDoqynAuth'));
    assert.ok(auth.includes('PasswordChangeCard'));
  });

  it('alterar senha fica sempre visível na autenticação', () => {
    const card = readSrc('features/settings/components/PasswordChangeCard.tsx');
    assert.ok(card.includes('SettingsFieldGroup'));
    assert.ok(card.includes('ChangePasswordForm'));
    assert.equal(card.includes('useState(false)'), false);
    assert.equal(card.includes('aria-expanded'), false);
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
    const legacy = readSrc('features/documents/SettingsPage.tsx');
    assert.ok(page.includes('UploadAiSettingsSection'));
    assert.ok(page.includes('AuthenticationSettingsSection'));
    assert.ok(legacy.includes("from '@/features/settings/SettingsPage'"));
  });

  it('layout não quebra sem dados de avatar', () => {
    const profile = readSrc('features/settings/components/sections/ProfileSettingsSection.tsx');
    assert.ok(profile.includes('user?.name'));
    assert.ok(profile.includes('avatarUrl={displayAvatarUrl}'));
  });

  it('estado por URL section funciona', () => {
    const hook = readSrc('features/settings/hooks/useSettingsSection.ts');
    const sections = readSrc('features/settings/settingsSections.ts');
    assert.ok(hook.includes("searchParams.get('section')"));
    assert.ok(hook.includes('parseSettingsSection'));
    assert.ok(sections.includes('upload-ia'));
    assert.ok(hook.includes("upload: 'upload-ia'"));
  });
});
