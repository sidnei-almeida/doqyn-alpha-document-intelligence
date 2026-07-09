import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { applyDocumentOwnershipOnInsert } from '../server/tenancy/documentOwnership.js';
import { resolveTenantStorageContextFromIds } from '../server/tenancy/tenantStorage.js';
import { canUserListDocument } from '../server/tenancy/documentAccess.js';
import type { AuthUser } from '../server/auth/types.js';
import { resolvePostAnalysisAction } from '../src/features/upload/config/uploadAutoConfirm.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

const businessCtx = resolveTenantStorageContextFromIds({
  tenantId: 'company_dev',
  tenantType: 'business',
});

const adminUser: AuthUser = {
  id: 'user_admin',
  email: 'admin@doqyn.dev',
  name: 'Admin',
  companyId: 'company_dev',
  role: 'admin',
  area: '',
  groups: [],
  platformRoles: ['doqyn_admin', 'company_admin', 'user'],
};

describe('confirmAnalysis persiste campos de tenant', () => {
  it('withTenantFieldsFromContext grava tenantType/tenantId em inserts business', () => {
    const service = readFileSync(
      join(__dirname, '..', 'server', 'services', 'confirmAnalysisService.ts'),
      'utf8',
    );
    assert.ok(service.includes('withTenantFieldsFromContext'));
    assert.ok(service.includes("processingStatus: needsReview ? 'processed_with_review' : 'processed'"));
    assert.ok(service.includes('classId: docClass._id'));

    const doc = applyDocumentOwnershipOnInsert(
      {
        _id: 'doc_test',
        classId: 'cat_juridico',
        status: 'active',
        processingStatus: 'processed',
      },
      { ...businessCtx, userId: 'user_admin' },
    );

    assert.equal(doc.tenantType, 'business');
    assert.equal(doc.tenantId, 'company_dev');
    assert.equal(doc.companyId, 'company_dev');
    assert.equal(doc.ownerUserId, 'user_admin');
  });
});

describe('listDocuments — visibilidade pós-upload', () => {
  it('documento ativo processado é listável para admin', () => {
    const doc = {
      ownerUserId: 'user_admin',
      access: { viewGroupIds: [], downloadGroupIds: [] },
    };
    assert.equal(canUserListDocument(adminUser, doc, []), true);
  });

  it('documento jurídico usa classId como categoryId na API', () => {
    const mapper = readFileSync(join(__dirname, '..', 'server', 'services', 'documentService.ts'), 'utf8');
    assert.ok(mapper.includes('categoryId: doc.classId'));
    assert.ok(mapper.includes("if (filters.categoryId) query.classId = filters.categoryId"));
  });

  it('filtro Processado inclui processed_with_review', () => {
    const service = readFileSync(join(__dirname, '..', 'server', 'services', 'documentService.ts'), 'utf8');
    assert.ok(service.includes("'processed', 'processed_with_review'"));
  });
});

describe('cache / invalidação da Biblioteca', () => {
  it('invalidateLibraryQueries invalida e refetch queries ativas', () => {
    const helper = readSrc('features/library/utils/libraryQueryInvalidation.ts');
    assert.ok(helper.includes("queryKey: ['documents']"));
    assert.ok(helper.includes("queryKey: ['document-categories-options']"));
    assert.ok(helper.includes("queryKey: ['dashboard-overview']"));
    assert.ok(helper.includes("refetchType: 'all'"));
    assert.ok(helper.includes('refetchQueries'));
    assert.ok(helper.includes("documents:refetch-after-confirm"));
  });

  it('UploadQueueProvider aguarda invalidateLibrary após confirm', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes('invalidateLibraryQueries'));
    assert.ok(provider.includes("logUploadDev('confirm:success'"));
    assert.ok(provider.includes('await invalidateLibrary()'));
  });

  it('useDocuments usa isAuthenticated e log de listagem', () => {
    const hook = readSrc('features/documents/hooks/useDocuments.ts');
    assert.ok(hook.includes('enabled: isAuthenticated'));
    assert.ok(hook.includes("logLibraryDev('documents:list-success'"));
    assert.ok(hook.includes("tenant?.tenantId ?? user?.companyId"));
  });
});

describe('fluxo upload → confirm → listagem (contratos)', () => {
  it('documento confirmado com cat_juridico aparece em recentes e pasta Jurídico', () => {
    const homeUtils = readSrc('features/library/utils/libraryHomeSections.ts');
    assert.ok(homeUtils.includes('pickRecentDocuments'));
    assert.ok(homeUtils.includes('pickUncategorizedDocuments'));

    const doc = applyDocumentOwnershipOnInsert(
      {
        _id: 'doc_upload_flow',
        classId: 'cat_juridico',
        status: 'active',
        processingStatus: 'processed',
        updatedAt: new Date().toISOString(),
      },
      { ...businessCtx, userId: 'user_admin' },
    );

    assert.equal(doc.classId, 'cat_juridico');
    assert.equal(doc.status, 'active');
    assert.equal(doc.processingStatus, 'processed');
    assert.equal(canUserListDocument(adminUser, doc, []), true);

    const filter = readFileSync(
      join(__dirname, '..', 'server', 'services', 'documentService.ts'),
      'utf8',
    );
    assert.ok(filter.includes("if (filters.categoryId) query.classId = filters.categoryId"));
  });

  it('auto-confirm off mantém review; auto-confirm on só completa após confirm', () => {
    const provider = readSrc('features/upload/UploadQueueProvider.tsx');
    assert.ok(provider.includes("status: 'review'"));
    assert.ok(provider.includes("type: 'done'"));
    assert.ok(provider.includes('documentId: result.documentId'));
    assert.ok(provider.includes('await invalidateLibrary()'));

    assert.equal(resolvePostAnalysisAction('completed', false), 'open_review');
    assert.equal(resolvePostAnalysisAction('completed', true), 'auto_confirm');
    assert.equal(resolvePostAnalysisAction('requires_review', false), 'open_review');
  });
});

describe('frontend não lista via R2', () => {
  it('api.documents.list sanitiza query params', () => {
    const api = readSrc('lib/api.ts');
    assert.ok(api.includes('serializeQueryParams'));
    const helper = readSrc('lib/queryParams.ts');
    assert.ok(helper.includes('value !== undefined'));
  });

  it('Biblioteca usa listDocuments da API', () => {
    const api = readSrc('features/documents/api/documentsApi.ts');
    assert.ok(api.includes('api.documents.list'));
    const library = readSrc('features/library/hooks/useLibraryView.ts');
    assert.ok(library.includes('useDocuments'));
    assert.equal(library.includes('R2'), false);
  });
});
