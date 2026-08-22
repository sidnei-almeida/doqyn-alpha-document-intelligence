import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAuditChangeSet } from '../server/audit/documentAuditHelpers.js';
import { buildDocumentAuditContext } from '../server/audit/buildDocumentAuditContext.js';
import {
  createDocumentAuditLog,
  listDocumentTimeline,
} from '../server/audit/documentAuditLogService.js';
import { SYSTEM_DOCUMENT_AUDIT_ACTIONS } from '../server/audit/documentAuditTypes.js';
import { resolveTenantStorageContextFromIds } from '../server/tenancy/tenantStorage.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';
import { ServiceError } from '../server/utils/serviceErrors.js';
import type { AuthUser } from '../server/auth/types.js';
import type { DocumentRequestContext } from '../server/tenancy/documentRequestContext.js';

function businessUser(tenantId: string): AuthUser {
  return {
    id: 'user_admin',
    email: 'admin@example.com',
    name: 'Admin',
    companyId: tenantId,
    tenantId,
    companyName: 'Empresa',
    role: 'admin',
    area: 'TI',
    groups: ['g1'],
    membershipId: 'mem_1',
    tenantType: 'business',
  };
}

function businessCtx(tenantId: string): DocumentRequestContext {
  const storage = resolveTenantStorageContextFromIds({
    tenantId,
    tenantType: 'business',
    collectionPrefix: tenantId,
    userId: 'user_admin',
  });

  return {
    tenantId,
    userId: 'user_admin',
    membershipId: 'mem_1',
    tenantType: 'business',
    storage,
    storageScope: {
      tenantId,
      tenantType: 'business',
      ownerUserId: 'user_admin',
      keyPrefix: tenantId,
      basePrefix: tenantId,
    },
    collections: {} as DocumentRequestContext['collections'],
  };
}

describe('document audit helpers', () => {
  it('buildAuditChangeSet registra apenas campos permitidos alterados', () => {
    const changes = buildAuditChangeSet(
      { title: 'Antigo', status: 'draft' },
      { title: 'Novo', status: 'draft' },
      ['title', 'status'],
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.field, 'title');
    assert.equal(changes[0]?.before, 'Antigo');
    assert.equal(changes[0]?.after, 'Novo');
  });

  it('sanitizeAuditMetadata remove segredos e PII', () => {
    const safe = sanitizeAuditMetadata({
      token: 'abc',
      password: 'secret',
      cpf: '123.456.789-00',
      cnpj: '12.345.678/0001-90',
      requestId: 'req_1',
    });
    assert.equal('token' in safe, false);
    assert.equal('password' in safe, false);
    assert.equal('cpf' in safe, false);
    assert.equal('cnpj' in safe, false);
    assert.equal(safe.requestId, 'req_1');
  });

  it('buildDocumentAuditContext usa sessão, não payload externo', () => {
    const ctx = buildDocumentAuditContext(businessCtx('company_a'), businessUser('company_a'), 'req_1');
    assert.equal(ctx.tenantId, 'company_a');
    assert.equal(ctx.actorUserId, 'user_admin');
    assert.equal(ctx.requestId, 'req_1');
    assert.equal(ctx.collectionPrefix, 'company_a');
  });
});

describe('document audit service validation', () => {
  it('createDocumentAuditLog exige actor em ação de usuário', async () => {
    await assert.rejects(
      () =>
        createDocumentAuditLog(
          {
            tenantId: 'company_a',
            tenantType: 'business',
            collectionPrefix: 'company_a',
            actorUserId: '',
          },
          {
            action: 'document.downloaded',
            description: 'Download',
            documentId: 'doc_1',
          },
        ),
      (error: unknown) => error instanceof ServiceError && error.code === 'AUDIT_ACTOR_REQUIRED',
    );
  });

  it('ações sistêmicas exigem actor system', async () => {
    for (const action of SYSTEM_DOCUMENT_AUDIT_ACTIONS) {
      await assert.rejects(
        () =>
          createDocumentAuditLog(
            {
              tenantId: 'company_a',
              tenantType: 'business',
              collectionPrefix: 'company_a',
              actorUserId: 'user_admin',
            },
            {
              action,
              description: 'Provisionamento',
            },
          ),
        (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_AUDIT_ACTOR',
      );
    }
  });

  it('listDocumentTimeline sem Mongo retorna vazio', async () => {
    const result = await listDocumentTimeline({
      ctx: buildDocumentAuditContext(businessCtx('company_a'), businessUser('company_a')),
      documentId: 'doc_missing',
    });
    assert.deepEqual(result, { items: [], nextCursor: null });
  });
});

describe('document audit tenant collections', () => {
  it('business resolve a coleção compartilhada audit_logs', () => {
    const storage = resolveTenantStorageContextFromIds({
      tenantId: 'company_a',
      tenantType: 'business',
      collectionPrefix: 'company_a',
    });
    assert.equal(storage.collections.auditLogs, 'audit_logs');
  });

  it('individual resolve a mesma coleção audit_logs', () => {
    const storage = resolveTenantStorageContextFromIds({
      tenantId: 'individual_alice',
      tenantType: 'individual',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
      userId: 'user_alice',
    });
    assert.equal(storage.collections.auditLogs, 'audit_logs');
  });
});
