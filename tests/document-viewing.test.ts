import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  isDocumentAdmin,
  resolveDocumentPermissions,
  userHasDocumentGroupAccess,
} from '../server/tenancy/documentAccess.js';
import { buildGovernanceAccessIndex } from '../server/tenancy/governanceAccessIndex.js';
import { getPreviewErrorMessage } from '../src/features/documents/utils/previewErrors.js';
import type { AuthUser } from '../server/auth/types.js';

function adminUser(): AuthUser {
  return {
    id: 'user_admin',
    email: 'admin@doqyn.dev',
    name: 'Admin',
    companyId: 'company_dev',
    tenantId: 'company_dev',
    role: 'admin',
    platformRoles: ['company_admin'],
  };
}

function commonUser(): AuthUser {
  return {
    id: 'user_common',
    email: 'user@doqyn.dev',
    name: 'User',
    companyId: 'company_dev',
    tenantId: 'company_dev',
    role: 'user',
    platformRoles: ['user'],
  };
}

describe('documentAccess permissions', () => {
  it('company_admin pode visualizar e baixar', () => {
    const perms = resolveDocumentPermissions(
      adminUser(),
      { ownerUserId: 'other', access: { viewGroupIds: [], downloadGroupIds: [] } },
      [],
    );
    assert.equal(perms.canPreview, true);
    assert.equal(perms.canDownload, true);
  });

  it('usuário comum sem grupo não visualiza', () => {
    const perms = resolveDocumentPermissions(
      commonUser(),
      {
        ownerUserId: 'other',
        access: { viewGroupIds: ['group_juridico'], downloadGroupIds: ['group_juridico'] },
      },
      [],
    );
    assert.equal(perms.canPreview, false);
    assert.equal(perms.canDownload, false);
  });

  it('usuário comum com regra ativa (grupo ↔ categoria) visualiza', () => {
    const governanceIndex = buildGovernanceAccessIndex([
      {
        categoryId: 'cat_juridico',
        groupId: 'group_juridico',
        active: true,
        permissions: { view: true, download: true, upload: false, share: false, manage: false },
      },
    ]);

    const perms = resolveDocumentPermissions(
      commonUser(),
      {
        ownerUserId: 'other',
        classId: 'cat_juridico',
        access: { viewGroupIds: [], downloadGroupIds: [] },
      },
      ['group_juridico'],
      governanceIndex,
    );
    assert.equal(perms.canPreview, true);
    assert.equal(perms.canDownload, true);
  });

  it('snapshot de grupos no documento não concede acesso sem regra ativa', () => {
    const perms = resolveDocumentPermissions(
      commonUser(),
      {
        ownerUserId: 'other',
        classId: 'cat_juridico',
        access: { viewGroupIds: ['group_juridico'], downloadGroupIds: ['group_juridico'] },
      },
      ['group_juridico'],
      buildGovernanceAccessIndex([]),
    );
    assert.equal(perms.canPreview, false);
    assert.equal(perms.canDownload, false);
  });

  it('owner visualiza mesmo sem grupo', () => {
    const user = commonUser();
    const perms = resolveDocumentPermissions(
      user,
      { ownerUserId: user.id, access: { viewGroupIds: [], downloadGroupIds: [] } },
      [],
    );
    assert.equal(perms.canPreview, true);
    assert.equal(perms.canDownload, true);
  });

  it('isDocumentAdmin reconhece company_admin', () => {
    assert.equal(isDocumentAdmin(adminUser()), true);
    assert.equal(isDocumentAdmin(commonUser()), false);
  });

  it('userHasDocumentGroupAccess exige interseção', () => {
    assert.equal(userHasDocumentGroupAccess(['a', 'b'], ['b']), true);
    assert.equal(userHasDocumentGroupAccess(['a'], ['b']), false);
    assert.equal(userHasDocumentGroupAccess([], ['b']), false);
  });
});

describe('preview error messages', () => {
  it('mapeia PREVIEW_NOT_READY', () => {
    const error = Object.assign(new Error('x'), { code: 'PREVIEW_NOT_READY' });
    const message = getPreviewErrorMessage(error);
    assert.match(message, /ainda não está disponível/i);
  });
});

describe('dev-server binary responses', () => {
  it('toVercelRes implementa send para preview/download', () => {
    const source = readFileSync(join(process.cwd(), 'server/dev-server.ts'), 'utf8');
    assert.match(source, /send\(data: string \| Buffer \| Uint8Array\)/);
  });
});

describe('document viewing UI', () => {
  const pageSource = readFileSync(
    join(process.cwd(), 'src/features/documents/DocumentsPage.tsx'),
    'utf8',
  );
  const viewerSource = readFileSync(
    join(process.cwd(), 'src/features/documents/components/DocumentPreviewViewer.tsx'),
    'utf8',
  );
  const apiSource = readFileSync(
    join(process.cwd(), 'src/features/documents/api/documentsApi.ts'),
    'utf8',
  );
  const hookSource = readFileSync(
    join(process.cwd(), 'src/features/documents/hooks/useDocuments.ts'),
    'utf8',
  );
  const modalSource = readFileSync(
    join(process.cwd(), 'src/features/documents/viewer/DocumentViewerModal.tsx'),
    'utf8',
  );
  const indexHandlerSource = readFileSync(join(process.cwd(), 'api/documents/index.ts'), 'utf8');
  const itemHandlerSource = readFileSync(join(process.cwd(), 'api/documents/item.ts'), 'utf8');

  it('DocumentsPage não usa MOCK_DOCUMENTS', () => {
    assert.equal(pageSource.includes('MOCK_DOCUMENTS'), false);
    assert.match(pageSource, /useDocuments/);
  });

  it('DocumentsPage usa modal central e ações de tabela', () => {
    assert.match(pageSource, /DocumentViewerModal/);
    assert.match(pageSource, /Detalhes/);
    assert.match(pageSource, /canDownload/);
    assert.match(pageSource, /canViewTracking/);
    assert.match(pageSource, /latestVersionId/);
    assert.doesNotMatch(pageSource, /objectKey|r2\.cloudflarestorage/i);
  });

  it('useDocuments chama API real com tenant no queryKey', () => {
    assert.match(hookSource, /listDocuments/);
    assert.match(hookSource, /tenant\?\.tenantId/);
  });

  it('DocumentViewerModal exibe preview via manifest e painel de detalhes', () => {
    assert.match(modalSource, /usePreviewManifest/);
    assert.match(modalSource, /resolveViewerComponent/);
    assert.match(modalSource, /DocumentViewerDetailsPanel/);
    assert.match(modalSource, /onClose/);
    assert.match(modalSource, /initialShowDetails/);
    assert.match(modalSource, /initialVersionId/);
    assert.doesNotMatch(modalSource, /setSelectedVersionId\(null\)/);
  });

  it('DocumentPreviewViewer delega para registry de manifest', () => {
    assert.match(viewerSource, /usePreviewManifest/);
    assert.match(viewerSource, /resolveViewerComponent/);
    assert.doesNotMatch(viewerSource, /<iframe|<object|<embed/);
  });

  it('DocumentPreviewViewer busca manifest autenticado via hook', () => {
    assert.match(viewerSource, /usePreviewManifest/);
    assert.doesNotMatch(viewerSource, /objectKey|presigned|r2\.cloudflarestorage/i);
  });

  it('documentsApi getDocument tem fallback para query id', () => {
    assert.match(apiSource, /\/api\/documents\/\$\{encodedId\}/);
    assert.match(apiSource, /\/api\/documents\?id=/);
  });

  it('documentsApi não expõe URL R2', () => {
    assert.match(apiSource, /listDocuments/);
    assert.match(apiSource, /getDocument/);
    assert.doesNotMatch(apiSource, /r2\.cloudflarestorage|presigned/i);
  });

  it('preview/download handlers usam res.send', () => {
    const previewSource = readFileSync(join(process.cwd(), 'api/documents/preview.ts'), 'utf8');
    const downloadSource = readFileSync(join(process.cwd(), 'api/documents/download.ts'), 'utf8');
    assert.match(previewSource, /\.send\(file\.buffer\)/);
    assert.match(downloadSource, /\.send\(file\.buffer\)/);
  });

  it('GET /api/documents exige autenticação', () => {
    assert.match(indexHandlerSource, /requireDocumentAuthContext/);
  });

  it('GET /api/documents/:documentId usa getDocumentDetail', () => {
    assert.match(itemHandlerSource, /getDocumentDetail/);
    assert.match(itemHandlerSource, /requireDocumentAuthContext/);
    assert.doesNotMatch(itemHandlerSource, /objectKey/i);
  });
});

describe('document list mapping', () => {
  it('listDocuments retorna permissions e storage por item', () => {
    const source = readFileSync(
      join(process.cwd(), 'server/services/documentService.ts'),
      'utf8',
    );
    assert.match(source, /canViewTracking/);
    assert.match(source, /hasOriginal/);
    assert.match(source, /hasPreview/);
    assert.match(source, /versionLabel/);
    assert.match(source, /categoryId/);
  });
});

describe('preview handler headers', () => {
  it('preview.ts define headers seguros e preview_viewed', () => {
    const source = readFileSync(join(process.cwd(), 'api/documents/preview.ts'), 'utf8');
    assert.match(source, /Cache-Control/);
    assert.match(source, /private, no-store/);
    assert.match(source, /document\.preview_viewed/);
    assert.match(source, /X-Content-Type-Options/);
    assert.doesNotMatch(source, /presigned|objectKey/i);
  });
});
