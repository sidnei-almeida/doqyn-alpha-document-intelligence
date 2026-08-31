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

  it('padrão visual compartilha o cabeçalho e a linha de configuração', () => {
    const pattern = readSrc('features/settings/settingsUiPattern.ts');
    const row = readSrc('features/settings/components/SettingsRow.tsx');
    const header = readSrc('features/settings/components/SettingsSectionHeader.tsx');

    // `SettingsStatusBadge` e `SettingsInfoCard` saíram com a reestruturação: o "Em breve" era
    // etiqueta em bloco que a tela não precisava, e o card virou linha — "linha, não caixa".
    assert.ok(pattern.includes('SETTINGS_UI_PATTERN'));
    assert.ok(row.includes('settings-row'));
    assert.ok(row.includes('settings-row__label'));
    assert.ok(header.includes('SettingsSectionHeader'));
  });

  it('o menu interno lista as duas seções, agrupadas por quem decide', () => {
    const sections = readSrc('features/settings/settingsSections.ts');
    const nav = readSrc('features/settings/components/SettingsSidebarNav.tsx');

    // Eram quatro seções por assunto (Perfil, Preferências, Upload e IA, Empresa). Passaram a ser
    // duas por dono da decisão: o que a pessoa muda sozinha, e o que vale para todo mundo.
    assert.ok(sections.includes('SETTINGS_NAV_ITEMS'));
    assert.ok(sections.includes("id: 'conta'"));
    assert.ok(sections.includes("id: 'organizacao'"));
    assert.ok(sections.includes("scope: 'personal'"));
    assert.ok(sections.includes("scope: 'organization'"));
    assert.ok(nav.includes('SETTINGS_NAV_ITEMS') || nav.includes('items'));

    const ids = [...sections.matchAll(/id: '([a-z-]+)',\n\s+label:/g)].map((m) => m[1]);
    assert.deepEqual(ids, ['conta', 'organizacao']);
  });

  it('Minha conta reúne perfil, preferências e autenticação numa tela só', () => {
    const account = readSrc('features/settings/components/sections/AccountSettingsSection.tsx');
    assert.ok(account.includes('ProfileSettingsSection'));
    assert.ok(account.includes('PreferencesSettingsSection'));
    assert.ok(account.includes('AuthenticationSettingsSection'));
    // Sem sub-abas: as três chegam empilhadas, cada uma com seu cabeçalho.
    assert.ok(account.includes('SettingsSectionHeader'));
    assert.equal(account.includes('useState'), false);
  });

  it('Organização reúne envio, IA e retenção, e só quem administra altera', () => {
    const org = readSrc('features/settings/components/sections/OrganizationSection.tsx');
    assert.ok(org.includes('UploadAiSettingsSection'));
    assert.ok(org.includes('TrashRetentionSettingsSection'));
    // Quem não administra lê e não altera — a barra de salvar depende disso.
    assert.ok(org.includes('governsOrganization'));
    assert.ok(org.includes('SettingsSaveBar'));
  });

  it('Upload e IA saiu do localStorage e passou a ser da organização', () => {
    const upload = readSrc('features/settings/components/sections/UploadAiSettingsSection.tsx');
    const org = readSrc('features/settings/components/sections/OrganizationSection.tsx');
    assert.ok(org.includes('UploadAiSettingsSection'));
    assert.equal(upload.includes('localStorage'), false);
  });

  it('Autenticação fica dentro de Minha conta', () => {
    const account = readSrc('features/settings/components/sections/AccountSettingsSection.tsx');
    const auth = readSrc('features/settings/components/sections/AuthenticationSettingsSection.tsx');
    assert.ok(account.includes('AuthenticationSettingsSection'));
    assert.ok(auth.includes('usesDoqynAuth'));
    // O formulário passou a ser montado direto; `PasswordChangeCard` era só o invólucro.
    assert.ok(auth.includes('ChangePasswordForm'));
    assert.ok(auth.includes('ChangeEmailCard'));
  });

  it('alterar senha fica sempre visível na autenticação', () => {
    const auth = readSrc('features/settings/components/sections/AuthenticationSettingsSection.tsx');
    const form = readSrc('features/settings/components/ChangePasswordForm.tsx');
    // Sempre visível: nada de acordeão escondendo a troca de senha atrás de um clique.
    assert.equal(auth.includes('aria-expanded'), false);
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

  it('header do usuário aponta só para configurações', () => {
    const menu = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(menu.includes('/settings'));
    assert.equal(menu.includes('ProfileSettingsDialog'), false);
    assert.equal(menu.includes('Configurações de perfil'), false);
  });

  it('nenhuma configuração crítica some do app', () => {
    const account = readSrc('features/settings/components/sections/AccountSettingsSection.tsx');
    const org = readSrc('features/settings/components/sections/OrganizationSection.tsx');
    const legacy = readSrc('features/documents/SettingsPage.tsx');
    assert.ok(org.includes('UploadAiSettingsSection'));
    assert.ok(account.includes('AuthenticationSettingsSection'));
    assert.ok(org.includes('TrashRetentionSettingsSection'));
    assert.ok(legacy.includes("from '@/features/settings/SettingsPage'"));
  });

  it('layout não quebra sem dados de avatar', () => {
    const profile = readSrc('features/settings/components/sections/ProfileSettingsSection.tsx');
    assert.ok(profile.includes('user?.name'));
    assert.ok(profile.includes('avatarUrl={displayAvatarUrl}'));
  });

  it('URLs antigas continuam abrindo em algum lugar certo', () => {
    const hook = readSrc('features/settings/hooks/useSettingsSection.ts');
    const sections = readSrc('features/settings/settingsSections.ts');

    // `?tab=` deixou de existir — cada seção é uma tela só — mas as URLs guardadas por aí não
    // podem cair numa tela em branco.
    assert.ok(hook.includes("searchParams.get('section')"));
    assert.ok(hook.includes("params.delete('tab')"));
    assert.ok(hook.includes('parseSettingsSection'));
    assert.ok(sections.includes('LEGACY_SECTION_ALIASES'));
    for (const legacy of ['perfil', 'preferencias', 'autenticacao', 'upload-ia', 'empresa', 'lixeira']) {
      assert.ok(sections.includes(`${legacy.includes('-') ? `'${legacy}'` : legacy}:`), legacy);
    }

    // A âncora `#upload` das Configurações antigas também.
    assert.ok(hook.includes("hash === 'upload'"));
    assert.ok(hook.includes("setSection('organizacao')"));
  });
});
