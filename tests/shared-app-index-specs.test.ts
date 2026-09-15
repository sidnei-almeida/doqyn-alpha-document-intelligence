import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { SHARED_APP_COLLECTIONS } from '../server/db/constants.js';
import { sharedAppIndexSpecs } from '../server/db/sharedAppIndexSpecs.js';

describe('índices das coleções globais no job de produção', () => {
  it('toda coleção global entra na lista, salvo as de caminho próprio', () => {
    const covered = new Set(sharedAppIndexSpecs().map((group) => group.collection));
    // `approval_requests` remove índices substituídos antes; `audit_chain_heads` não define índice.
    const ownPath = new Set<string>([
      SHARED_APP_COLLECTIONS.approvalRequests,
      SHARED_APP_COLLECTIONS.auditChainHeads,
    ]);
    const missing = Object.values(SHARED_APP_COLLECTIONS).filter(
      (name) => !ownPath.has(name) && !covered.has(name),
    );
    assert.deepEqual(missing, []);
  });

  it('o script do Compose usa a lista única', () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const script = readFileSync(join(repoRoot, 'scripts/ensure-mongodb-indexes.ts'), 'utf8');
    assert.ok(script.includes('sharedAppIndexSpecs()'));
  });
});
