import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('convidado aparece antes de existir conta', () => {
  it('a linha vem do convite no auth-service, não de um registro no Mongo', () => {
    const api = read('src/features/users/api/doqynUsersApi.ts');
    assert.ok(api.includes('listPendingInvites'));
    assert.ok(api.includes("authServiceJson<{ invites: PendingInviteDto[] }>"));

    // Nada é gravado no Mongo para representar o convidado: duplicá-lo criaria uma segunda
    // verdade a reconciliar, e um aceite que falhasse deixaria a cópia convidando para sempre.
    const page = read('src/features/users/UsersPage.tsx');
    assert.ok(page.includes("status: 'invited' as const"));
    assert.ok(page.includes('invitedRows'));
  });

  it('o convite carrega o prazo, e vencido continua na lista', () => {
    const page = read('src/features/users/UsersPage.tsx');
    // Sumir com o vencido faria o convite desaparecer sem aviso, e quem administra concluiria
    // que a pessoa entrou.
    assert.ok(page.includes("usersPage.inviteExpired'"));
    assert.ok(page.includes('Convite válido até'));
  });

  it('revogar é a única ação sobre um convite', () => {
    const page = read('src/features/users/UsersPage.tsx');
    assert.ok(page.includes("usersPage.actions.revokeInvite'"));
    assert.ok(page.includes("hidden: member.status !== 'invited'"));
  });
});

describe('entrada de membro avisa quem administra', () => {
  it('o aviso sai no sync, depois dos grupos', () => {
    const sync = read('server/services/tenantMemberSyncService.ts');
    // As chamadas, não os imports: o aviso diz que a pessoa entrou, e ela só entrou de fato
    // quando alcança alguma coisa.
    const grupos = sync.indexOf('await applyPendingInviteGroups({');
    const notificar = sync.indexOf('await notifyMemberJoined({');
    assert.ok(grupos > 0);
    assert.ok(notificar > grupos);
  });

  it('vai para quem convidou e para quem administra, nunca para o recém-chegado', () => {
    const fonte = read('server/services/notifications/memberNotifications.ts');
    assert.ok(fonte.includes("member.tenantRoles?.includes('company_admin')"));
    assert.ok(fonte.includes('invitedByMembershipId'));
    // `emitNotifications` descarta o ator, e o ator aqui é a própria pessoa que entrou.
    assert.ok(fonte.includes('actorUserId: input.member.authUserId'));
  });

  it('sai também por e-mail, e não só pelo sino', () => {
    const prefs = read('server/services/notifications/notificationPreferences.ts');
    const bloco = prefs.slice(prefs.indexOf('EMAIL_ELIGIBLE_TYPES'), prefs.indexOf('isEmailEligible'));
    assert.ok(bloco.includes("'member_joined'"));
  });
});
