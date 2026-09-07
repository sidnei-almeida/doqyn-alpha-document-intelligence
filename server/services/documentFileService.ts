import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import type { AuthUser } from '../auth/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentVersion } from '../db/types.js';
import {
  buildVersionStorage,
  getStorageProvider,
  persistDocumentVersionFile,
} from '../storage/index.js';
import { isR2StorageEnabled } from '../storage/storageConfig.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  assertCanAccessDocument,
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import {
  foreignDocumentPermissions,
  isForeignScope,
  resolveDocumentReadScope,
} from '../tenancy/documentReadScope.js';
import { resolveDocumentApproval } from './approvals/documentApprovalGate.js';
import { assertCanDownloadDocument, loadDocumentAccessContext } from '../tenancy/documentAccess.js';
import { resolveDocumentPermissionsWithShare } from '../tenancy/documentShareAccess.js';
import { findActiveShareGrantForUser } from './sharing/documentShareService.js';

function buildPendingStorage(): MongoDocumentVersion['storage'] {
  return {
    primary: {
      provider: 'aws_s3',
      status: 'pending',
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
    backup: {
      provider: 'cloudflare_r2',
      status: 'pending',
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
  };
}

export async function storeUploadedDocumentFile(input: {
  tenantId: string;
  documentId: string;
  versionId: string;
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
  storageFileName: string;
  storageScope?: TenantStorageScope;
}): Promise<MongoDocumentVersion['storage']> {
  const provider = getStorageProvider();
  if (!provider || input.buffer.length === 0) {
    return buildPendingStorage();
  }

  const extension = input.originalFileName.split('.').pop();
  const stored = await persistDocumentVersionFile({
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionId: input.versionId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    extension,
    storageFileName: input.storageFileName,
    storageScope: input.storageScope,
  });

  if (!stored) {
    return buildPendingStorage();
  }

  return buildVersionStorage(stored);
}

export async function readDocumentVersionFile(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId?: string;
  storageScope?: TenantStorageScope;
  user: AuthUser;
  membershipId?: string;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  storageKey: string;
}> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Arquivo não disponível.', 'FILE_NOT_FOUND', 404);
  }

  // Onde este documento mora, para esta pessoa: quase sempre o tenant da sessão; o de origem
  // quando ele veio de outra empresa e foi aceito.
  const scope = await resolveDocumentReadScope({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    userId: input.user.id,
  });

  const { documents, documentVersions, storage } = await getTenantCollections(scope.tenantId, {
    userId: scope.ownerUserId,
  });

  const doc = await documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  /**
   * Documento de outra empresa: quem autoriza é a concessão, e nada mais.
   *
   * A resolução normal consulta a governança do tenant de quem lê e dá tudo a quem administra
   * **lá** — aplicá-la aqui faria o admin de qualquer tenant ganhar poder total sobre o que outra
   * empresa apenas emprestou a um funcionário dele.
   */
  const permissions = isForeignScope(scope)
    ? foreignDocumentPermissions(scope.foreignGrant)
    : await (async () => {
        const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
          tenantId: input.tenantId,
          userId: input.user.id,
          membershipId: input.membershipId,
        });
        const shareGrant = await findActiveShareGrantForUser(input.documentId, input.user.id);
        return resolveDocumentPermissionsWithShare(
          input.user,
          doc as MongoDocument,
          memberGroupIds,
          shareGrant,
          governanceIndex,
        );
      })();
  if (permissions.requiresApproval.download) {
    // O verbo existe para esta pessoa, só não acontece sozinho. Em vez de 403, abre o pedido e
    // devolve o estado — quem chamou decide como contar isso na tela.
    const gate = await resolveDocumentApproval({
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      user: input.user,
      doc: doc as MongoDocument,
      kind: 'document_download',
    });

    if (gate.state !== 'allowed') {
      throw new ServiceError(
        gate.state === 'pending'
          ? 'Seu pedido para baixar este documento está aguardando aprovação.'
          : 'Baixar este documento depende de aprovação. Seu pedido foi enviado ao administrador.',
        'DOCUMENT_APPROVAL_REQUIRED',
        409,
      );
    }
  } else {
    assertCanDownloadDocument(permissions);
  }

  const resolvedVersionId = input.versionId ?? (doc as MongoDocument).currentVersionId;
  const version = await documentVersions.findOne({
    _id: resolvedVersionId,
    documentId: input.documentId,
    ...buildDocumentOwnershipFilter(storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  const versionDoc = version as MongoDocumentVersion;
  const primaryStorage = versionDoc.storage?.primary;
  const storageKey = primaryStorage?.objectKey;

  if (!storageKey) {
    throw new ServiceError('Arquivo ainda não disponível.', 'FILE_NOT_STORED', 404);
  }

  if (primaryStorage?.provider === 'local' && isR2StorageEnabled()) {
    throw new ServiceError(
      'Documento armazenado em provider legado/local não disponível após migração para R2.',
      'LEGACY_LOCAL_STORAGE',
      410,
    );
  }

  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentVersion(
    storageKey,
    input.tenantId,
    primaryStorage?.bucketAlias,
    input.storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: versionDoc.file?.mimeType ?? file.contentType ?? 'application/octet-stream',
    fileName: versionDoc.finalFileName || versionDoc.originalFileName || 'documento',
    storageKey,
  };
}
