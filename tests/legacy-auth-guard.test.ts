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

describe('legacy auth endpoint guards', () => {
  it('bloqueia convite legado quando provider é doqyn_auth', () => {
    const guard = read('server/auth/legacyAuthGuard.ts');
    const invite = read('api/company-members/invite.ts');
    assert.ok(guard.includes('usesDoqynAuth'));
    assert.ok(guard.includes('410'));
    assert.ok(invite.includes('rejectLegacyAuthEndpoint'));
    assert.ok(invite.includes('membership_invite'));
  });

  it('bloqueia access-requests legado quando provider é doqyn_auth', () => {
    const access = read('api/auth/access-requests.ts');
    assert.ok(access.includes('rejectLegacyAuthEndpoint'));
    assert.ok(access.includes('public_access_request'));
  });
});
