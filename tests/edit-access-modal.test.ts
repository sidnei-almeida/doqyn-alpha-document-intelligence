import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  cloneAccessFormState,
  isAccessFormDirty,
} from '../src/features/users/accessFormState.js';
import { PLATFORM_ROLE_LABELS } from '../src/features/users/platformRoleLabels.js';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  email: true,
  whatsapp: true,
  documentCreated: true,
  documentUpdated: true,
  documentRequiresSignature: true,
  accessApproved: true,
  accessRejected: true,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('componentes de formulário DOQYN', () => {
  it('Checkbox customizado não usa aparência nativa visível', () => {
    const source = readSrc('components/ui/Checkbox.tsx');
    assert.ok(source.includes('peer sr-only'));
    assert.ok(source.includes('peer-checked:border-doqyn-primary'));
    assert.ok(source.includes('AppCheckbox'));
    assert.ok(source.includes('focus-visible:ring-doqyn-accent-active'));
  });

  it('Radio e Switch exportam aliases AppRadio/AppSwitch', () => {
    const radio = readSrc('components/ui/Radio.tsx');
    const switchSource = readSrc('components/ui/Switch.tsx');
    assert.ok(radio.includes('AppRadio'));
    assert.ok(switchSource.includes('AppSwitch'));
    assert.ok(switchSource.includes('role="switch"'));
  });

  it('globals.css define accent-color de fallback', () => {
    const source = readFileSync(join(srcRoot, 'styles/globals.css'), 'utf8');
    assert.ok(source.includes('accent-color: var(--accent-active)'));
  });
});

describe('modal Editar acesso — UX e dirty state', () => {
  it('EditAccessDialog usa seções compartilhadas e checkboxes customizados', () => {
    const dialog = readSrc('features/users/components/EditAccessDialog.tsx');
    const sections = readSrc('features/users/components/AccessFormSections.tsx');
    assert.ok(dialog.includes('EditAccessDialog'));
    assert.ok(dialog.includes('PlatformRolesSection'));
    assert.ok(dialog.includes('isAccessFormDirty'));
    assert.ok(dialog.includes('Descartar alterações'));
    assert.ok(sections.includes('from \'@/components/ui/Checkbox\''));
    assert.equal(sections.includes('type="checkbox"'), false);
  });

  it('roles exibem labels amigáveis mantendo valores internos', () => {
    assert.equal(PLATFORM_ROLE_LABELS.doqyn_admin.label, 'Administrador DOQYN');
    assert.equal(PLATFORM_ROLE_LABELS.company_admin.label, 'Administrador da empresa');
    assert.equal(PLATFORM_ROLE_LABELS.user.label, 'Usuário');
    const sections = readSrc('features/users/components/AccessFormSections.tsx');
    assert.ok(sections.includes('PLATFORM_ROLE_LABELS'));
    assert.ok(sections.includes('permissões administrativas globais'));
  });

  it('Salvar desabilitado sem alterações e habilitado após mudança', () => {
    const baseline = cloneAccessFormState({
      platformRoles: ['user'],
      accessGroupIds: [],
      documentGroupIds: [],
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    });
    const unchanged = cloneAccessFormState(baseline);
    assert.equal(isAccessFormDirty(unchanged, baseline), false);

    const changedRoles = cloneAccessFormState(baseline);
    changedRoles.platformRoles = ['user', 'company_admin'];
    assert.equal(isAccessFormDirty(changedRoles, baseline), true);

    const dialog = readSrc('features/users/components/EditAccessDialog.tsx');
    assert.ok(dialog.includes('disabled={!dirty || saving}'));
    assert.ok(dialog.includes('Alterações não salvas'));
  });

  it('grupos de acesso vazios mostram empty state com CTA', () => {
    const sections = readSrc('features/users/components/AccessFormSections.tsx');
    assert.ok(sections.includes('GroupsEmptyState'));
    assert.ok(sections.includes('Nenhum grupo de acesso criado ainda.'));
    assert.ok(sections.includes('Crie grupos de acesso em Usuários'));
  });

  it('grupos documentais usam cards com Checkbox customizado', () => {
    const sections = readSrc('features/users/components/AccessFormSections.tsx');
    assert.ok(sections.includes('DocumentGroupsSection'));
    assert.ok(sections.includes('Grupo documental de governança'));
    assert.ok(sections.includes('memberCount'));
    assert.equal(sections.includes('type="checkbox"'), false);
  });

  it('mutation de salvar envia payload correto com roles e grupos', () => {
    const page = readSrc('features/users/UsersPage.tsx');
    assert.ok(page.includes('usersApi.updateAccess'));
    assert.ok(page.includes('platformRoles: form.platformRoles'));
    assert.ok(page.includes('accessGroupIds: form.accessGroupIds'));
    assert.ok(page.includes('notificationPreferences: form.notificationPreferences'));
    assert.ok(page.includes('usersApi.updateDocumentGroups'));
    assert.ok(page.includes('form.documentGroupIds'));
  });

  it('UsersPage não usa checkbox nativo na modal de editar acesso', () => {
    const page = readSrc('features/users/UsersPage.tsx');
    assert.ok(page.includes('EditAccessDialog'));
    assert.equal(page.includes('function RoleCheckboxes'), false);
    assert.equal(page.includes('function GroupCheckboxes'), false);
  });
});

describe('consistência global de checkboxes', () => {
  it('Login usa Checkbox customizado', () => {
    const source = readSrc('pages/Login.tsx');
    assert.ok(source.includes('@/components/ui/Checkbox'));
    assert.equal(source.includes('type="checkbox"'), false);
  });

  it('ApproveApprovalDialog reutiliza AccessFormSections', () => {
    const source = readSrc('features/audit/components/ApproveApprovalDialog.tsx');
    assert.ok(source.includes('AccessFormSections'));
    assert.equal(source.includes('type="checkbox"'), false);
  });

  it('GovernanceDetailDialog usa Checkbox nas permissões', () => {
    const source = readSrc('features/rules/components/governance/GovernanceDetailDialog.tsx');
    assert.ok(source.includes('@/components/ui/Checkbox'));
    assert.equal(source.includes('accent-doqyn-action'), false);
  });
});
