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

describe('bloqueio de acesso na tela /users', () => {
  it('UsersPage usa modal e rótulos de bloqueio/desbloqueio', () => {
    const page = readSrc('features/users/UsersPage.tsx');
    assert.ok(page.includes('BlockAccessDialog'));
    assert.ok(page.includes('UnblockAccessDialog'));
    assert.ok(page.includes('Bloquear acesso'));
    assert.ok(page.includes('Desbloquear acesso'));
    assert.ok(page.includes('Acesso bloqueado com sucesso.'));
    assert.ok(page.includes('Acesso desbloqueado com sucesso.'));
    assert.ok(!page.includes("toast.success('Usuário bloqueado.')"));
  });

  it('BlockAccessDialog confirma bloqueio com motivo opcional', () => {
    const dialog = readSrc('features/users/components/BlockAccessDialog.tsx');
    assert.ok(dialog.includes('Bloquear acesso à empresa?'));
    assert.ok(dialog.includes('Motivo do bloqueio'));
    assert.ok(dialog.includes('maxLength={300}'));
    assert.ok(dialog.includes('As sessões ativas nesta empresa serão revogadas.'));
  });

  it('doqynUsersApi.block envia body JSON válido', () => {
    const api = readSrc('features/users/api/doqynUsersApi.ts');
    assert.ok(api.includes('/block'));
    assert.ok(api.includes('body: JSON.stringify(body)'));
    assert.ok(api.includes('reason?.trim()'));
  });

  it('authServiceClient não força Content-Type sem body', () => {
    const client = readSrc('auth/authServiceClient.ts');
    assert.equal(client.includes("'Content-Type': 'application/json'"), false);
  });
});
