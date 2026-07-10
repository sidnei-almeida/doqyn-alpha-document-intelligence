import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('tenant live sync', () => {
  it('WorkspaceLayout ativa sincronização automática do tenant', () => {
    const layout = readSrc('src/app/layout/WorkspaceLayout.tsx');
    assert.ok(layout.includes('useTenantLiveSync'));
  });

  it('useCompanyMembers usa polling e refetch ao focar', () => {
    const hook = readSrc('src/features/users/hooks/useCompanyMembers.ts');
    assert.ok(hook.includes('tenantLiveSyncQueryOptions'));
    assert.ok(hook.includes("queryKey: ['company-members', tenantId]"));
  });

  it('AuthProvider refaz fetch das queries do tenant ao focar janela', () => {
    const auth = readSrc('src/auth/AuthProvider.tsx');
    assert.ok(auth.includes('refetchTenantScopedQueries'));
    assert.ok(auth.includes('syncSessionIfChanged'));
  });

  it('useRules sincroniza membros a partir da query compartilhada', () => {
    const rules = readSrc('src/features/rules/hooks/useRules.ts');
    assert.ok(rules.includes('useCompanyMembers'));
    assert.ok(rules.includes('mapCompanyMemberDtoToRulesMember'));
    assert.equal(rules.includes('getCompanyMembers'), false);
  });

  it('refetchTenantScopedQueries cobre usuários, auditoria e biblioteca', () => {
    const sync = readSrc('src/features/tenant/tenantLiveSync.ts');
    assert.ok(sync.includes("['company-members', tenantId]"));
    assert.ok(sync.includes("['audit-pending', tenantId]"));
    assert.ok(sync.includes("['documents', tenantId]"));
    assert.ok(sync.includes('TENANT_LIVE_SYNC_INTERVAL_MS'));
  });
});
