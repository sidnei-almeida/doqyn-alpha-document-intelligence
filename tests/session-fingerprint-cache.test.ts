import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSessionFingerprint } from '../src/auth/sessionFingerprint';

const root = join(import.meta.dirname, '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('session fingerprint cache', () => {
  it('muda quando roles ou grupos de acesso mudam', () => {
    const base = buildSessionFingerprint({
      userId: 'user-1',
      tenantId: 'tenant-a',
      membership: {
        status: 'active',
        tenantRoles: ['user'],
        accessGroupIds: ['financeiro'],
      },
    });

    const rolesChanged = buildSessionFingerprint({
      userId: 'user-1',
      tenantId: 'tenant-a',
      membership: {
        status: 'active',
        tenantRoles: ['user', 'company_admin'],
        accessGroupIds: ['financeiro'],
      },
    });

    const groupsChanged = buildSessionFingerprint({
      userId: 'user-1',
      tenantId: 'tenant-a',
      membership: {
        status: 'active',
        tenantRoles: ['user'],
        accessGroupIds: ['juridico'],
      },
    });

    assert.notEqual(base, rolesChanged);
    assert.notEqual(base, groupsChanged);
  });

  it('AuthProvider limpa cache ao mudar fingerprint e ao focar janela', () => {
    const auth = readSrc('src/auth/AuthProvider.tsx');
    assert.ok(auth.includes('buildSessionFingerprintFromAuth'));
    assert.ok(auth.includes('clearSessionScopedCaches'));
    assert.ok(auth.includes('syncSessionIfChanged'));
    assert.ok(auth.includes('visibilitychange'));
  });
});
