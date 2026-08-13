import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { resolveSignatureConfig } from '../../config/signatureConfig.js';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  DocumentSignaturePermissions,
  DocumentSignatureStatusLabel,
  MongoDocument,
  MongoDocumentSignature,
  MongoDocumentSignatureRequest,
  MongoDocumentSignatureSigner,
  MongoDocumentVersion,
} from '../../db/types.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';
import {
  assertCanAccessDocument,
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import { loadMemberDocumentGroupIds } from '../../tenancy/documentAccess.js';
import { canUserShareDocument } from '../../tenancy/documentShareAccess.js';
import { resolveDocumentAccessWithShare } from '../sharing/documentShareService.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { resolveTenantStorageScopeById } from '../../tenancy/resolveTenantStorageScope.js';
import { getStorageProvider, persistPreviewAsset } from '../../storage/index.js';
import { buildSignatureArtifactObjectKey } from '../../storage/storageKeys.js';
import { isR2StorageEnabled } from '../../storage/storageConfig.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  isSignatureRequestOpen,
  resolveEffectiveSignatureRequestStatus,
} from './signatureRequestStatus.js';
import {
  INVALID_RECIPIENT_PHONE_MESSAGE,
  isValidEmail,
  normalizeEmail,
  parseOptionalRecipientPhone,
} from '../../utils/contactNormalize.js';
import { maskEmail } from '../../utils/maskSensitiveData.js';
import { hashTrackingValue } from '../tracking/trackingSecurity.js';
import { buildSecurityContext, type TrackingSecurityContext } from '../tracking/securityContext.js';
import type { VercelRequest } from '@vercel/node';
import type { DocumentAuditContext } from '../../audit/documentAuditTypes.js';
import {
  generateSignaturePortalToken,
  generateVerificationCode,
  hashSignaturePortalToken,
} from './signatureTokens.js';
import { SIGNATURE_CONSENT_TEXT, generateSignedPdf } from './signaturePdfService.js';
import { promoteSignedPdfToDocumentVersion } from './promoteSignedPdfToDocumentVersion.js';
import { resolveInternalSignerForTenant } from './signatureRecipientValidation.js';
import { normalizeVersionLabel } from '../../utils/versionLabelUtils.js';
import { loadDocumentSignatureSummary } from './documentSignatureSummaryService.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultSignaturePermissions(
  input?: Partial<DocumentSignaturePermissions>,
): DocumentSignaturePermissions {
  return {
    canView: input?.canView !== false,
    canSign: input?.canSign !== false,
    canDownloadAfterSign: input?.canDownloadAfterSign === true,
  };
}

function resolveSignerPhoneFields(value?: string | null) {
  if (!value?.trim()) {
    return { phone: null, phoneNormalized: null, phoneMasked: null };
  }
  try {
    const parsed = parseOptionalRecipientPhone(value);
    if (!parsed) return { phone: null, phoneNormalized: null, phoneMasked: null };
    return {
      phone: parsed.recipientPhone,
      phoneNormalized: parsed.recipientPhoneNormalized,
      phoneMasked: parsed.recipientPhoneMasked,
    };
  } catch {
    throw new ServiceError(INVALID_RECIPIENT_PHONE_MESSAGE, 'INVALID_RECIPIENT_PHONE', 400);
  }
}

async function getSignatureRequestsCollection(): Promise<Collection<MongoDocumentSignatureRequest>> {
  const db = await getDb();
  return db.collection<MongoDocumentSignatureRequest>(
    SHARED_APP_COLLECTIONS.documentSignatureRequests,
  );
}

async function getSignaturesCollection(): Promise<Collection<MongoDocumentSignature>> {
  const db = await getDb();
  return db.collection<MongoDocumentSignature>(SHARED_APP_COLLECTIONS.documentSignatures);
}

export function buildSignaturePortalPath(token: string): string {
  return `/guest/sign/${encodeURIComponent(token)}`;
}

export function buildSignaturePortalUrl(token: string, origin?: string): string {
  const base = origin?.trim() || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}${buildSignaturePortalPath(token)}`;
}

export function buildSignatureVerificationPath(code: string): string {
  return `/verify/signature/${encodeURIComponent(code)}`;
}

export function buildSignatureVerificationUrl(code: string, origin?: string): string {
  const base = origin?.trim() || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}${buildSignatureVerificationPath(code)}`;
}

export async function findSignatureRequestByToken(
  token: string,
): Promise<MongoDocumentSignatureRequest | null> {
  if (!isMongoNativeConfigured() || !token?.trim()) return null;
  const collection = await getSignatureRequestsCollection();
  return collection.findOne({ signatureTokenHash: hashSignaturePortalToken(token) });
}

function defaultSignerPermissions(
  permissions: DocumentSignaturePermissions,
): MongoDocumentSignatureSigner['permissions'] {
  return {
    canViewForSigning: permissions.canView,
    canSign: permissions.canSign,
    canDownloadSignedPdf: permissions.canDownloadAfterSign,
  };
}

function getPrimarySigner(request: MongoDocumentSignatureRequest): MongoDocumentSignatureSigner {
  return request.signers[0];
}

export async function requireAssignedInternalSignatureRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
  options: {
    requireOpen?: boolean;
    requireCanView?: boolean;
    requireCanSign?: boolean;
  } = {},
): Promise<MongoDocumentSignatureRequest> {
  const collection = await getSignatureRequestsCollection();
  const request = await collection.findOne({
    signatureRequestId,
    tenantId: ctx.tenantId,
  });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }

  const signer = getPrimarySigner(request);
  if (signer.signerType !== 'internal_user' || signer.userId !== user.id) {
    throw new ServiceError('Usuário não autorizado.', 'SIGNATURE_FORBIDDEN', 403);
  }
  if (options.requireOpen !== false && !isSignatureRequestOpen(request)) {
    throw new ServiceError('Solicitação de assinatura indisponível.', 'SIGNATURE_REQUEST_CLOSED', 403);
  }
  if (options.requireCanView && !request.permissions.canView) {
    throw new ServiceError('Visualização não permitida.', 'SIGNATURE_PREVIEW_DENIED', 403);
  }
  if (options.requireCanSign && !request.permissions.canSign) {
    throw new ServiceError('Assinatura não permitida.', 'SIGNATURE_FORBIDDEN', 403);
  }

  return request;
}

async function userHasSignatureDocumentAccess(
  ctx: DocumentRequestContext,
  user: AuthUser,
  request: MongoDocumentSignatureRequest,
): Promise<boolean> {
  const signer = getPrimarySigner(request);
  if (signer.signerType === 'internal_user' && signer.userId === user.id) {
    return true;
  }

  const { documents, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });
  const doc = await documents.findOne({
    _id: request.documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);
  if (!doc) return false;

  try {
    assertCanAccessDocument(doc as Record<string, unknown>, storage);
  } catch {
    return false;
  }

  const { permissions } = await resolveDocumentAccessWithShare({
    user,
    doc: doc as MongoDocument,
    sharedWithUserId: user.id,
    tenantId: ctx.tenantId,
    membershipId: ctx.membershipId,
  });
  return permissions.canPreview || permissions.canDownload;
}

export async function requireSignaturePortalRequest(
  token: string,
  options: {
    requireOpen?: boolean;
    requireCanView?: boolean;
    requireCanSign?: boolean;
  } = {},
): Promise<MongoDocumentSignatureRequest> {
  const request = await findSignatureRequestByToken(token);
  if (!request) {
    throw new ServiceError('Convite de assinatura inválido.', 'SIGNATURE_TOKEN_INVALID', 404);
  }
  if (options.requireOpen !== false && !isSignatureRequestOpen(request)) {
    throw new ServiceError('Solicitação de assinatura indisponível.', 'SIGNATURE_REQUEST_CLOSED', 403);
  }
  if (options.requireCanView && !request.permissions.canView) {
    throw new ServiceError('Visualização não permitida.', 'SIGNATURE_PREVIEW_DENIED', 403);
  }
  if (options.requireCanSign && !request.permissions.canSign) {
    throw new ServiceError('Assinatura não permitida.', 'SIGNATURE_FORBIDDEN', 403);
  }
  const signer = getPrimarySigner(request);
  if (signer.signerType !== 'external_guest') {
    throw new ServiceError('Convite de assinatura inválido.', 'SIGNATURE_TOKEN_INVALID', 404);
  }
  return request;
}

export async function loadSignatureRequestDocumentContext(
  request: MongoDocumentSignatureRequest,
): Promise<{
  doc: MongoDocument;
  version: MongoDocumentVersion;
  storageScope: Awaited<ReturnType<typeof resolveTenantStorageScopeById>>;
}> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Documento indisponível.', 'SIGNATURE_DOCUMENT_UNAVAILABLE', 403);
  }

  const storageScope = await resolveTenantStorageScopeById(
    request.tenantId,
    request.requestedByUserId,
  );
  const { documents, documentVersions, storage } = await getTenantCollections(request.tenantId, {
    userId: request.requestedByUserId,
  });

  const doc = await documents.findOne({
    _id: request.documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento indisponível.', 'SIGNATURE_DOCUMENT_UNAVAILABLE', 403);
  }

  const version = await documentVersions.findOne({
    _id: request.versionId,
    documentId: request.documentId,
    ...buildDocumentOwnershipFilter(storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new ServiceError('Versão da solicitação indisponível.', 'SIGNATURE_VERSION_NOT_FOUND', 404);
  }

  return {
    doc: doc as MongoDocument,
    version: version as MongoDocumentVersion,
    storageScope,
  };
}

export async function readSignatureRequestVersionFile(input: {
  request: MongoDocumentSignatureRequest;
  version: MongoDocumentVersion;
  storageScope: Awaited<ReturnType<typeof resolveTenantStorageScopeById>>;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const primaryStorage = input.version.storage?.primary;
  const storageKey = primaryStorage?.objectKey;
  if (!storageKey) {
    throw new ServiceError('Arquivo ainda não disponível.', 'FILE_NOT_STORED', 404);
  }
  if (primaryStorage?.provider === 'local' && isR2StorageEnabled()) {
    throw new ServiceError('Arquivo indisponível.', 'FILE_NOT_FOUND', 404);
  }

  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentVersion(
    storageKey,
    input.request.tenantId,
    primaryStorage?.bucketAlias,
    input.storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: input.version.file?.mimeType ?? file.contentType ?? 'application/octet-stream',
    fileName: input.version.finalFileName || input.version.originalFileName || 'documento',
  };
}

async function loadSignableDocument(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
): Promise<{ doc: MongoDocument; version: MongoDocumentVersion }> {
  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });
  const { documents, documentVersions, storage } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });
  const doc = await documents.findOne({
    _id: documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);
  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }
  assertCanAccessDocument(doc as Record<string, unknown>, storage);
  if (!canUserShareDocument(user, doc as MongoDocument, memberGroupIds)) {
    throw new ServiceError('Sem permissão para solicitar assinatura.', 'SIGNATURE_FORBIDDEN', 403);
  }

  const version = await documentVersions.findOne({
    _id: (doc as MongoDocument).currentVersionId,
    documentId,
  });
  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }
  const mime = version.file?.mimeType?.toLowerCase() ?? '';
  if (!mime.includes('pdf')) {
    throw new ServiceError('Apenas documentos PDF podem ser assinados nesta fase.', 'SIGNATURE_PDF_ONLY', 400);
  }

  return {
    doc: doc as MongoDocument,
    version: version as MongoDocumentVersion,
  };
}

async function readVersionPdfBuffer(input: {
  request: MongoDocumentSignatureRequest;
  version: MongoDocumentVersion;
}): Promise<Buffer> {
  const { storageScope } = await loadSignatureRequestDocumentContext(input.request);
  const file = await readSignatureRequestVersionFile({
    request: input.request,
    version: input.version,
    storageScope,
  });
  return file.buffer;
}

function serializeSigner(signer: MongoDocumentSignatureSigner) {
  return {
    signerId: signer.signerId,
    signerType: signer.signerType,
    userId: signer.userId ?? null,
    name: signer.name,
    emailMasked: maskEmail(signer.email) ?? '***',
    phoneMasked: signer.phoneMasked ?? null,
    organizationName: signer.organizationName ?? null,
    status: signer.status,
    signedAt: signer.signedAt?.toISOString() ?? null,
    order: signer.order ?? null,
  };
}

export function serializeSignatureRequest(
  request: MongoDocumentSignatureRequest,
  options?: { includePortalUrl?: boolean; portalToken?: string; origin?: string },
) {
  return {
    signatureRequestId: request.signatureRequestId,
    documentId: request.documentId,
    versionId: request.versionId,
    status: resolveEffectiveSignatureRequestStatus(request),
    permissions: request.permissions,
    signers: request.signers.map(serializeSigner),
    message: request.message ?? null,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
    portalUrl:
      options?.includePortalUrl && options.portalToken
        ? buildSignaturePortalUrl(options.portalToken, options.origin)
        : undefined,
  };
}

export async function createDocumentSignatureRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
  input: {
    signerName?: string;
    signerEmail?: string;
    signerPhone?: string;
    signerOrganizationName?: string;
    signerType?: 'internal_user' | 'external_guest';
    signerUserId?: string;
    message?: string;
    expiresAt?: string;
    permissions?: Partial<DocumentSignaturePermissions>;
  },
  origin?: string,
) {
  const signerType = input.signerType ?? 'external_guest';
  const { doc, version } = await loadSignableDocument(ctx, user, documentId);
  const config = resolveSignatureConfig();
  const now = new Date();
  const signatureRequestId = randomUUID();
  const signerId = randomUUID();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : addDays(now, config.defaultExpiryDays);
  const permissions = defaultSignaturePermissions(input.permissions);

  let signerName = input.signerName?.trim() ?? '';
  let signerEmail = input.signerEmail?.trim() ?? '';
  let signerUserId: string | null = null;
  let portalToken: string | undefined;
  let signatureTokenHash: string | null = null;
  let phoneFields = resolveSignerPhoneFields(input.signerPhone);

  if (signerType === 'internal_user') {
    const internalSigner = await resolveInternalSignerForTenant(ctx, user, input.signerUserId ?? '');
    signerName = internalSigner.name;
    signerEmail = internalSigner.email;
    signerUserId = internalSigner.userId;
    phoneFields = { phone: null, phoneNormalized: null, phoneMasked: null };
  } else {
    if (!signerName) {
      throw new ServiceError('Nome do signatário é obrigatório.', 'SIGNER_NAME_REQUIRED', 400);
    }
    if (!isValidEmail(signerEmail)) {
      throw new ServiceError('E-mail do signatário inválido.', 'INVALID_SIGNER_EMAIL', 400);
    }
    portalToken = generateSignaturePortalToken();
    signatureTokenHash = hashSignaturePortalToken(portalToken);
  }

  const request: MongoDocumentSignatureRequest = {
    _id: signatureRequestId,
    signatureRequestId,
    documentId,
    versionId: version._id,
    tenantId: ctx.tenantId,
    documentTenantType: (ctx.tenantType ?? 'business') as MongoDocumentSignatureRequest['documentTenantType'],
    requestedByUserId: user.id,
    requestedByNameSnapshot: user.name ?? user.email ?? user.id,
    status: 'pending',
    permissions,
    signatureTokenHash,
    message: input.message?.trim() || null,
    expiresAt,
    signers: [
      {
        signerId,
        signerType,
        userId: signerUserId,
        tenantId: signerType === 'internal_user' ? ctx.tenantId : null,
        name: signerName,
        email: signerEmail,
        emailNormalized: normalizeEmail(signerEmail),
        phone: phoneFields.phone,
        phoneNormalized: phoneFields.phoneNormalized,
        phoneMasked: phoneFields.phoneMasked,
        organizationName: input.signerOrganizationName?.trim() || null,
        permissions: defaultSignerPermissions(permissions),
        status: 'pending',
        expiresAt,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getSignatureRequestsCollection();
  await collection.insertOne(request);

  const tenantCollections = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });
  await tenantCollections.documents.updateOne(
    { _id: documentId },
    { $set: { signatureStatus: 'pending', updatedAt: now } },
  );

  return {
    request: serializeSignatureRequest(request, {
      includePortalUrl: signerType === 'external_guest',
      portalToken,
      origin,
    }),
    portalToken,
    signerType,
    documentName: doc.currentFileName || doc.title,
  };
}

export async function listDocumentSignatureRequests(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
) {
  await loadSignableDocument(ctx, user, documentId);
  const collection = await getSignatureRequestsCollection();
  const items = await collection
    .find({ documentId, tenantId: ctx.tenantId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const signatures = await getSignaturesCollection();
  const signatureRows = await signatures
    .find({ documentId, signatureRequestId: { $in: items.map((item) => item.signatureRequestId) } })
    .toArray();
  const signatureByRequest = new Map(signatureRows.map((row) => [row.signatureRequestId, row]));

  return {
    items: items.map((item) => {
      const signature = signatureByRequest.get(item.signatureRequestId);
      return {
        ...serializeSignatureRequest(item),
        requestedByName: item.requestedByNameSnapshot ?? 'DOQYN',
        signature: signature
          ? {
              signatureId: signature.signatureId,
              verificationCode: signature.verificationCode,
              signedAt: signature.signedAt.toISOString(),
              hasSignedPdf: Boolean(signature.signedPdfR2Key),
              hasEvidence: Boolean(signature.evidenceJsonR2Key),
            }
          : null,
      };
    }),
  };
}

export async function getDocumentSignatureRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
) {
  const collection = await getSignatureRequestsCollection();
  const request = await collection.findOne({
    signatureRequestId,
    tenantId: ctx.tenantId,
  });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }
  const signer = getPrimarySigner(request);
  const isAssignee = signer.signerType === 'internal_user' && signer.userId === user.id;
  if (!isAssignee) {
    await loadSignableDocument(ctx, user, request.documentId);
  } else if (!(await userHasSignatureDocumentAccess(ctx, user, request))) {
    throw new ServiceError('Usuário não autorizado.', 'SIGNATURE_FORBIDDEN', 403);
  }
  return serializeSignatureRequest(request);
}

export async function listSignatureRequestsAssignedToMe(
  ctx: DocumentRequestContext,
  user: AuthUser,
) {
  const collection = await getSignatureRequestsCollection();
  const items = await collection
    .find({
      tenantId: ctx.tenantId,
      'signers.userId': user.id,
      'signers.signerType': 'internal_user',
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const { documents, documentVersions } = await getTenantCollections(ctx.tenantId, {
    userId: ctx.userId,
    membershipId: ctx.membershipId,
  });

  const mapped = items
    .filter((item) => {
      const signer = getPrimarySigner(item);
      return signer.userId === user.id;
    })
    .map((item) => {
      const signer = getPrimarySigner(item);
      const effectiveStatus = !isSignatureRequestOpen(item)
        ? item.status === 'signed'
          ? 'signed'
          : item.expiresAt && item.expiresAt.getTime() <= Date.now()
            ? 'expired'
            : item.status
        : signer.status === 'pending'
          ? 'pending'
          : signer.status;
      return { item, signer, effectiveStatus };
    });

  const results = await Promise.all(
    mapped.map(async ({ item, signer, effectiveStatus }) => {
      const doc = await documents.findOne({
        _id: item.documentId,
        ...ACTIVE_DOCUMENT_FILTER,
      } as Record<string, unknown>);
      const version = await documentVersions.findOne({
        _id: item.versionId,
        documentId: item.documentId,
      } as Record<string, unknown>);

      return {
        signatureRequestId: item.signatureRequestId,
        documentId: item.documentId,
        documentName: (doc as MongoDocument | null)?.currentFileName ?? (doc as MongoDocument | null)?.title ?? 'Documento',
        versionId: item.versionId,
        versionLabel: normalizeVersionLabel((version as MongoDocumentVersion | null)?.versionLabel),
        requestedBy: item.requestedByNameSnapshot ?? 'DOQYN',
        requestedAt: item.createdAt.toISOString(),
        expiresAt: item.expiresAt?.toISOString() ?? null,
        status: effectiveStatus,
        signerStatus: signer.status,
        canSign: item.permissions.canSign && effectiveStatus === 'pending',
      };
    }),
  );

  return { items: results };
}

export async function getInternalSignatureSigningPayload(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
) {
  const request = await requireAssignedInternalSignatureRequest(ctx, user, signatureRequestId, {
    requireOpen: true,
    requireCanView: true,
  });
  const { doc, version } = await loadSignatureRequestDocumentContext(request);
  const signer = getPrimarySigner(request);
  const versionLabel = version.versionLabel ?? doc.currentVersionLabel ?? null;
  const isVersionStale = doc.currentVersionId !== request.versionId;

  return {
    signatureRequestId: request.signatureRequestId,
    documentId: request.documentId,
    versionId: request.versionId,
    versionLabel,
    isVersionStale,
    documentName: doc.currentFileName || doc.title,
    issuerName: request.requestedByNameSnapshot ?? 'DOQYN',
    signer: serializeSigner(signer),
    permissions: request.permissions,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    message: request.message ?? null,
    consentText: SIGNATURE_CONSENT_TEXT,
    status: request.status,
    signerType: 'internal_user' as const,
  };
}

export async function getSignaturePortalPayload(token: string) {
  const request = await requireSignaturePortalRequest(token, { requireOpen: true });
  const { doc, version } = await loadSignatureRequestDocumentContext(request);
  const signer = request.signers[0];
  const versionLabel = version.versionLabel ?? doc.currentVersionLabel ?? null;
  const isVersionStale = doc.currentVersionId !== request.versionId;

  return {
    signatureRequestId: request.signatureRequestId,
    documentId: request.documentId,
    versionId: request.versionId,
    versionLabel,
    isVersionStale,
    documentName: doc.currentFileName || doc.title,
    issuerName: request.requestedByNameSnapshot ?? 'DOQYN',
    signer: serializeSigner(signer),
    permissions: request.permissions,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    message: request.message ?? null,
    consentText: SIGNATURE_CONSENT_TEXT,
    status: request.status,
  };
}

export async function completeDocumentSignature(input: {
  token?: string;
  signatureRequestId?: string;
  consentAccepted: boolean;
  req?: Pick<VercelRequest, 'headers'> & { socket?: VercelRequest['socket'] };
  authUser?: AuthUser;
  origin?: string;
}) {
  if (!input.consentAccepted) {
    throw new ServiceError('Aceite explícito é obrigatório.', 'SIGNATURE_CONSENT_REQUIRED', 400);
  }

  let request: MongoDocumentSignatureRequest | null = null;
  if (input.token?.trim()) {
    request = await findSignatureRequestByToken(input.token);
  } else if (input.signatureRequestId?.trim()) {
    const collection = await getSignatureRequestsCollection();
    request = await collection.findOne({ signatureRequestId: input.signatureRequestId.trim() });
  }

  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }
  if (!isSignatureRequestOpen(request)) {
    throw new ServiceError('Solicitação expirada ou encerrada.', 'SIGNATURE_REQUEST_CLOSED', 403);
  }

  const signer = request.signers[0];
  if (signer.status !== 'pending') {
    throw new ServiceError('Signatário já respondeu.', 'SIGNATURE_ALREADY_COMPLETED', 409);
  }

  const isExternal = Boolean(input.token?.trim());
  if (isExternal) {
    if (!request.permissions.canSign) {
      throw new ServiceError('Assinatura não permitida.', 'SIGNATURE_FORBIDDEN', 403);
    }
  } else if (!input.authUser) {
    throw new ServiceError('Autenticação obrigatória.', 'UNAUTHORIZED', 401);
  } else if (signer.signerType === 'internal_user' && signer.userId && signer.userId !== input.authUser.id) {
    throw new ServiceError('Usuário não autorizado a assinar.', 'SIGNATURE_FORBIDDEN', 403);
  }

  const signatures = await getSignaturesCollection();
  const existing = await signatures.findOne({ signatureRequestId: request.signatureRequestId });
  if (existing) {
    throw new ServiceError('Documento já assinado.', 'SIGNATURE_ALREADY_COMPLETED', 409);
  }

  const collections = await getTenantCollections(request.tenantId);
  const doc = await collections.documents.findOne({ _id: request.documentId, ...ACTIVE_DOCUMENT_FILTER });
  const version = await collections.documentVersions.findOne({
    _id: request.versionId,
    documentId: request.documentId,
  });
  if (!doc || !version) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const originalPdfBuffer = await readVersionPdfBuffer({ request, version: version as MongoDocumentVersion });

  const completedSignatureCount = await signatures.countDocuments({
    documentId: request.documentId,
    status: 'signed',
  });

  const priorSignatures = await signatures
    .find({
      documentId: request.documentId,
      versionId: request.versionId,
      status: 'signed',
      signatureRequestId: { $ne: request.signatureRequestId },
    })
    .sort({ signedAt: 1 })
    .toArray();

  const previousStamps = priorSignatures.map((entry) => ({
    signerName: entry.signerName,
    signedAt: entry.signedAt,
    verificationCode: entry.verificationCode,
  }));

  const signedAt = new Date();
  const signatureId = randomUUID();
  const verificationCode = generateVerificationCode();
  const verificationUrl = buildSignatureVerificationUrl(verificationCode, input.origin);
  const securityContext: TrackingSecurityContext = buildSecurityContext(input.req, {
    isExternalGuest: isExternal,
    authMethod: isExternal ? 'signature_token' : 'logged_in_session',
  });

  const pdfResult = await generateSignedPdf({
    originalPdfBuffer,
    documentName: doc.currentFileName || doc.title,
    documentId: request.documentId,
    versionId: request.versionId,
    signatureRequestId: request.signatureRequestId,
    signatureId,
    signerName: signer.name,
    signerEmailMasked: maskEmail(signer.email) ?? '***',
    signerPhoneMasked: signer.phoneMasked ?? undefined,
    organizationName: signer.organizationName ?? undefined,
    signedAt,
    verificationCode,
    verificationUrl,
    securityContext,
    issuerOrganizationName: request.requestedByNameSnapshot ?? undefined,
    previousStamps,
    completedSignatureCount,
  });

  const storageScope = await resolveTenantStorageScopeById(
    request.tenantId,
    request.documentTenantType,
  );
  const signedPdfKey = buildSignatureArtifactObjectKey({
    documentId: request.documentId,
    versionId: request.versionId,
    signatureRequestId: request.signatureRequestId,
    artifactName: 'signed.pdf',
    keyPrefix: storageScope.keyPrefix,
    basePrefix: storageScope.basePrefix,
  });
  const evidenceKey = buildSignatureArtifactObjectKey({
    documentId: request.documentId,
    versionId: request.versionId,
    signatureRequestId: request.signatureRequestId,
    artifactName: 'evidence.json',
    keyPrefix: storageScope.keyPrefix,
    basePrefix: storageScope.basePrefix,
  });

  const signedStored = await persistPreviewAsset({
    tenantId: request.tenantId,
    objectKey: signedPdfKey,
    buffer: pdfResult.signedPdfBuffer,
    contentType: 'application/pdf',
    bucketAlias: version.storage?.primary?.bucketAlias ?? null,
    storageScope,
  });
  const evidenceStored = await persistPreviewAsset({
    tenantId: request.tenantId,
    objectKey: evidenceKey,
    buffer: Buffer.from(JSON.stringify(pdfResult.evidencePayload, null, 2), 'utf8'),
    contentType: 'application/json',
    bucketAlias: version.storage?.primary?.bucketAlias ?? null,
    storageScope,
  });
  if (!signedStored || !evidenceStored) {
    throw new ServiceError('Falha ao persistir artefatos de assinatura.', 'SIGNATURE_STORAGE_FAILED', 500);
  }

  const promotedByUserId =
    input.authUser?.id ?? signer.userId ?? request.requestedByUserId;

  const promotedVersion = await promoteSignedPdfToDocumentVersion({
    tenantId: request.tenantId,
    documentId: request.documentId,
    sourceVersion: version as MongoDocumentVersion,
    doc: doc as MongoDocument,
    signedPdfBuffer: pdfResult.signedPdfBuffer,
    signedPdfHashSha256: pdfResult.signedPdfHashSha256,
    signatureRequestId: request.signatureRequestId,
    signatureId,
    promotedByUserId,
    storageScope,
  });

  const signature: MongoDocumentSignature = {
    _id: signatureId,
    signatureId,
    signatureRequestId: request.signatureRequestId,
    documentId: request.documentId,
    versionId: request.versionId,
    signerId: signer.signerId,
    signerType: signer.signerType,
    signerUserId: signer.userId ?? input.authUser?.id ?? null,
    signerName: signer.name,
    signerEmailMasked: maskEmail(signer.email) ?? '***',
    signerEmailHash: hashTrackingValue(signer.email, 'doqyn-signer-email-v1'),
    signerPhoneMasked: signer.phoneMasked ?? null,
    signerPhoneHash: signer.phoneNormalized
      ? hashTrackingValue(signer.phoneNormalized, 'doqyn-signer-phone-v1')
      : null,
    organizationName: signer.organizationName ?? null,
    status: 'signed',
    signedAt,
    consentText: SIGNATURE_CONSENT_TEXT,
    authMethod: isExternal ? 'signature_token' : 'logged_in_session',
    securityContext,
    originalDocumentHashSha256: pdfResult.originalDocumentHashSha256,
    signedPdfHashSha256: pdfResult.signedPdfHashSha256,
    evidenceHashSha256: pdfResult.evidenceHashSha256,
    signedPdfR2Key: signedPdfKey,
    evidenceJsonR2Key: evidenceKey,
    verificationCode,
    verificationUrl,
    promotedVersionId: promotedVersion.versionId,
    createdAt: signedAt,
  };

  await signatures.insertOne(signature);

  const requests = await getSignatureRequestsCollection();
  await requests.updateOne(
    { signatureRequestId: request.signatureRequestId },
    {
      $set: {
        status: 'signed',
        completedAt: signedAt,
        updatedAt: signedAt,
        'signers.0.status': 'signed',
        'signers.0.signedAt': signedAt,
      },
    },
  );

  return {
    signatureId,
    verificationCode,
    verificationUrl,
    signedAt: signedAt.toISOString(),
    canDownload: request.permissions.canDownloadAfterSign,
    promotedVersionId: promotedVersion.versionId,
    promotedVersionLabel: promotedVersion.versionLabel,
    promotedFileName: promotedVersion.finalFileName,
  };
}

export async function declineDocumentSignature(input: {
  token?: string;
  signatureRequestId?: string;
  reason?: string;
}) {
  let request: MongoDocumentSignatureRequest | null = null;
  if (input.token?.trim()) {
    request = await findSignatureRequestByToken(input.token);
  } else if (input.signatureRequestId?.trim()) {
    const collection = await getSignatureRequestsCollection();
    request = await collection.findOne({ signatureRequestId: input.signatureRequestId.trim() });
  }
  if (!request || !isSignatureRequestOpen(request)) {
    throw new ServiceError('Solicitação indisponível.', 'SIGNATURE_REQUEST_CLOSED', 403);
  }

  const now = new Date();
  const requests = await getSignatureRequestsCollection();
  await requests.updateOne(
    { signatureRequestId: request.signatureRequestId },
    {
      $set: {
        status: 'declined',
        updatedAt: now,
        'signers.0.status': 'declined',
      },
    },
  );

  const collections = await getTenantCollections(request.tenantId);
  await collections.documents.updateOne(
    { _id: request.documentId },
    { $set: { signatureStatus: 'declined', updatedAt: now } },
  );
}

async function syncDocumentSignatureStatus(tenantId: string, documentId: string): Promise<void> {
  const summary = await loadDocumentSignatureSummary(tenantId, documentId);
  let signatureStatus: DocumentSignatureStatusLabel;

  if (summary.signedCount > 0) {
    signatureStatus = 'signed';
  } else if (summary.status === 'pending') {
    signatureStatus = 'pending';
  } else if (summary.status === 'declined') {
    signatureStatus = 'declined';
  } else if (summary.status === 'expired') {
    signatureStatus = 'expired';
  } else {
    signatureStatus = 'none';
  }

  const { documents } = await getTenantCollections(tenantId);
  await documents.updateOne(
    { _id: documentId },
    { $set: { signatureStatus, updatedAt: new Date() } },
  );
}

export async function cancelDocumentSignatureRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
  options?: { expectedDocumentId?: string },
) {
  const collection = await getSignatureRequestsCollection();
  const request = await collection.findOne({
    signatureRequestId,
    tenantId: ctx.tenantId,
  });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }

  if (options?.expectedDocumentId && request.documentId !== options.expectedDocumentId) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }

  await loadSignableDocument(ctx, user, request.documentId);

  if (!isSignatureRequestOpen(request)) {
    throw new ServiceError(
      'Solicitação não pode ser revogada.',
      'SIGNATURE_REQUEST_NOT_CANCELLABLE',
      409,
    );
  }

  const now = new Date();
  await collection.updateOne(
    { signatureRequestId: request.signatureRequestId },
    {
      $set: {
        status: 'cancelled',
        updatedAt: now,
        cancelledAt: now,
        cancelledBy: user.id,
        signatureTokenHash: null,
        'signers.0.status': 'declined',
      },
    },
  );

  await syncDocumentSignatureStatus(ctx.tenantId, request.documentId);

  return {
    signatureRequestId: request.signatureRequestId,
    documentId: request.documentId,
    status: 'cancelled' as const,
  };
}

export async function getPublicSignatureVerification(verificationCode: string) {
  const signatures = await getSignaturesCollection();
  const signature = await signatures.findOne({ verificationCode: verificationCode.trim() });
  if (!signature) {
    throw new ServiceError('Assinatura não encontrada.', 'SIGNATURE_VERIFICATION_NOT_FOUND', 404);
  }

  return {
    valid: signature.status === 'signed',
    status: signature.status,
    verificationCode: signature.verificationCode,
    documentId: signature.documentId,
    versionId: signature.versionId,
    signerNameMasked: signature.signerName.replace(/\s\S+$/, ' ***'),
    signerEmailMasked: signature.signerEmailMasked,
    signedAt: signature.signedAt.toISOString(),
    originalDocumentHashSha256: signature.originalDocumentHashSha256,
    signedPdfHashSha256: signature.signedPdfHashSha256,
    integrityStatus: signature.status === 'signed' ? 'ok' : 'invalidated',
    method: 'Assinatura eletrônica DOQYN',
  };
}

export async function readSignedPdfBufferForRequest(signatureRequestId: string): Promise<{
  buffer: Buffer;
  fileName: string;
  request: MongoDocumentSignatureRequest;
  signature: MongoDocumentSignature;
}> {
  const signatures = await getSignaturesCollection();
  const signature = await signatures.findOne({ signatureRequestId });
  if (!signature || signature.status !== 'signed' || !signature.signedPdfR2Key) {
    throw new ServiceError('PDF assinado indisponível.', 'SIGNED_PDF_NOT_FOUND', 404);
  }

  const requests = await getSignatureRequestsCollection();
  const request = await requests.findOne({ signatureRequestId });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }

  const storageScope = await resolveTenantStorageScopeById(
    request.tenantId,
    request.documentTenantType,
  );
  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const collections = await getTenantCollections(request.tenantId);
  const doc = await collections.documents.findOne({
    _id: request.documentId,
    ...ACTIVE_DOCUMENT_FILTER,
  });
  if (!doc) {
    throw new ServiceError('Documento indisponível.', 'SIGNATURE_DOCUMENT_UNAVAILABLE', 403);
  }

  const file = await provider.readDocumentVersion(
    signature.signedPdfR2Key,
    request.tenantId,
    null,
    storageScope,
  );

  const baseName = doc.currentFileName?.replace(/\.pdf$/i, '') ?? doc.title ?? 'documento';
  return {
    buffer: file.buffer,
    fileName: `${baseName}-assinado-${signature.verificationCode}.pdf`,
    request,
    signature,
  };
}

export async function readSignedPdfForAuthenticatedRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
): Promise<{
  buffer: Buffer;
  fileName: string;
  request: MongoDocumentSignatureRequest;
  signature: MongoDocumentSignature;
}> {
  const requests = await getSignatureRequestsCollection();
  const request = await requests.findOne({
    signatureRequestId,
    tenantId: ctx.tenantId,
  });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }

  const hasAccess = await userHasSignatureDocumentAccess(ctx, user, request);
  if (!hasAccess) {
    throw new ServiceError('Sem permissão para baixar este documento.', 'SIGNATURE_DOWNLOAD_DENIED', 403);
  }

  const signer = getPrimarySigner(request);
  const isAssignedSigner = signer.signerType === 'internal_user' && signer.userId === user.id;
  if (isAssignedSigner && !request.permissions.canDownloadAfterSign) {
    throw new ServiceError('Download não permitido.', 'SIGNATURE_DOWNLOAD_DENIED', 403);
  }

  return readSignedPdfBufferForRequest(signatureRequestId);
}

export async function readEvidenceJsonForAuthenticatedRequest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
): Promise<{
  buffer: Buffer;
  fileName: string;
  request: MongoDocumentSignatureRequest;
  signature: MongoDocumentSignature;
}> {
  const file = await readSignedPdfForAuthenticatedRequest(ctx, user, signatureRequestId);
  if (!file.signature.evidenceJsonR2Key) {
    throw new ServiceError('Evidências indisponíveis.', 'SIGNATURE_EVIDENCE_NOT_FOUND', 404);
  }

  const storageScope = await resolveTenantStorageScopeById(
    file.request.tenantId,
    file.request.documentTenantType,
  );
  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const evidenceFile = await provider.readDocumentVersion(
    file.signature.evidenceJsonR2Key,
    file.request.tenantId,
    null,
    storageScope,
  );

  const baseName =
    file.request.documentId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'documento';
  return {
    buffer: evidenceFile.buffer,
    fileName: `${baseName}-evidencias-${file.signature.verificationCode}.json`,
    request: file.request,
    signature: file.signature,
  };
}

export async function readSignedPdfForRequest(signatureRequestId: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const file = await readSignedPdfBufferForRequest(signatureRequestId);
  return {
    buffer: file.buffer,
    fileName: file.fileName,
  };
}

export async function readSignedPdfForToken(token: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const request = await findSignatureRequestByToken(token);
  if (!request) {
    throw new ServiceError('Convite de assinatura inválido.', 'SIGNATURE_TOKEN_INVALID', 404);
  }
  if (request.status !== 'signed') {
    throw new ServiceError('PDF assinado indisponível.', 'SIGNED_PDF_NOT_FOUND', 404);
  }
  if (!request.permissions.canDownloadAfterSign) {
    throw new ServiceError('Download não permitido.', 'SIGNATURE_DOWNLOAD_DENIED', 403);
  }
  return readSignedPdfBufferForRequest(request.signatureRequestId);
}

export function buildSignatureAuditContext(
  request: MongoDocumentSignatureRequest,
  requestId?: string,
): DocumentAuditContext {
  return {
    tenantId: request.tenantId,
    tenantType: request.documentTenantType ?? 'business',
    collectionPrefix: request.tenantId,
    ownerTenantId: request.tenantId,
    ownerUserId: request.requestedByUserId,
    actorUserId: request.requestedByUserId,
    actorDisplayName: request.requestedByNameSnapshot ?? undefined,
    requestId,
  };
}

/** Contexto de auditoria para ações do signatário externo no portal público. */
export function buildExternalSignatureAuditContext(
  request: MongoDocumentSignatureRequest,
  requestId?: string,
): DocumentAuditContext {
  const signer = request.signers[0];
  const emailHash = signer
    ? hashTrackingValue(signer.email, 'doqyn-signer-email-v1')
    : 'unknown';

  return {
    tenantId: request.tenantId,
    tenantType: request.documentTenantType ?? 'business',
    collectionPrefix: request.tenantId,
    ownerTenantId: request.tenantId,
    ownerUserId: request.requestedByUserId,
    actorUserId: `external_guest:${emailHash}`,
    actorDisplayName: signer?.name ?? 'Convidado externo',
    actorEmail: signer ? (maskEmail(signer.email) ?? undefined) : undefined,
    actorRole: 'external_guest',
    requestId,
  };
}

export function buildSignatureTrackingMetadata(
  request: MongoDocumentSignatureRequest,
  extra: Record<string, unknown> = {},
) {
  const signer = request.signers[0];
  return {
    signatureRequestId: request.signatureRequestId,
    signerType: signer?.signerType ?? 'external_guest',
    signerId: signer?.signerId,
    signerUserId: signer?.userId ?? undefined,
    signerName: signer?.name,
    signerEmailMasked: signer ? maskEmail(signer.email) : undefined,
    signerEmailHash: signer
      ? hashTrackingValue(signer.email, 'doqyn-signer-email-v1')
      : undefined,
    signerPhoneMasked: signer?.phoneMasked ?? undefined,
    requestedByUserId: request.requestedByUserId,
    requestedByNameSnapshot: request.requestedByNameSnapshot ?? undefined,
    source: 'signature_request',
    ...extra,
  };
}
