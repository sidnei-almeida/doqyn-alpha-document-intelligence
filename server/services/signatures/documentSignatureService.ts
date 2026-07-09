import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { resolveSignatureConfig } from '../../config/signatureConfig.js';
import { SHARED_APP_COLLECTIONS } from '../../db/constants.js';
import { getDb, isMongoNativeConfigured } from '../../db/mongoClient.js';
import type {
  DocumentSignaturePermissions,
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
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import { loadMemberDocumentGroupIds } from '../../tenancy/documentAccess.js';
import { canUserShareDocument } from '../../tenancy/documentShareAccess.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { resolveTenantStorageScopeById } from '../../tenancy/resolveTenantStorageScope.js';
import { getStorageProvider, persistPreviewAsset } from '../../storage/index.js';
import { buildSignatureArtifactObjectKey } from '../../storage/storageKeys.js';
import { isR2StorageEnabled } from '../../storage/storageConfig.js';
import { ServiceError } from '../../utils/serviceErrors.js';
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

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
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

function isRequestOpen(request: MongoDocumentSignatureRequest): boolean {
  if (request.status === 'cancelled' || request.status === 'declined' || request.status === 'signed') {
    return false;
  }
  if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) return false;
  return request.status === 'pending' || request.status === 'partially_signed';
}

async function loadSignableDocument(
  ctx: DocumentRequestContext,
  user: AuthUser,
  documentId: string,
): Promise<{ doc: MongoDocument; version: MongoDocumentVersion; documentCollection: string }> {
  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: ctx.tenantId,
    userId: user.id,
    membershipId: ctx.membershipId,
  });
  const { documents, documentVersions, storage, names } = await getTenantCollections(ctx.tenantId, {
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
    documentCollection: names.documents,
  };
}

async function readVersionPdfBuffer(input: {
  request: MongoDocumentSignatureRequest;
  version: MongoDocumentVersion;
}): Promise<Buffer> {
  const storageScope = await resolveTenantStorageScopeById(
    input.request.documentTenantId,
    input.request.documentTenantType,
  );
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
    input.request.documentTenantId,
    primaryStorage?.bucketAlias,
    storageScope,
  );
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
    status: request.status,
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
    signerName: string;
    signerEmail: string;
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
  if (!input.signerName?.trim()) {
    throw new ServiceError('Nome do signatário é obrigatório.', 'SIGNER_NAME_REQUIRED', 400);
  }
  if (!isValidEmail(input.signerEmail)) {
    throw new ServiceError('E-mail do signatário inválido.', 'INVALID_SIGNER_EMAIL', 400);
  }

  const { doc, version, documentCollection } = await loadSignableDocument(ctx, user, documentId);
  const config = resolveSignatureConfig();
  const now = new Date();
  const portalToken = generateSignaturePortalToken();
  const signatureRequestId = randomUUID();
  const signerId = randomUUID();
  const phoneFields = resolveSignerPhoneFields(input.signerPhone);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : addDays(now, config.defaultExpiryDays);

  const request: MongoDocumentSignatureRequest = {
    _id: signatureRequestId,
    signatureRequestId,
    documentId,
    versionId: version._id,
    documentTenantId: ctx.tenantId,
    documentTenantType: (ctx.tenantType ?? 'business') as MongoDocumentSignatureRequest['documentTenantType'],
    documentCollection,
    requestedByUserId: user.id,
    requestedByNameSnapshot: user.name ?? user.email ?? user.id,
    status: 'pending',
    permissions: defaultSignaturePermissions(input.permissions),
    signatureTokenHash: hashSignaturePortalToken(portalToken),
    message: input.message?.trim() || null,
    expiresAt,
    signers: [
      {
        signerId,
        signerType: input.signerType ?? 'external_guest',
        userId: input.signerUserId ?? null,
        name: input.signerName.trim(),
        email: input.signerEmail.trim(),
        emailNormalized: normalizeEmail(input.signerEmail),
        phone: phoneFields.phone,
        phoneNormalized: phoneFields.phoneNormalized,
        phoneMasked: phoneFields.phoneMasked,
        organizationName: input.signerOrganizationName?.trim() || null,
        status: 'pending',
        order: 1,
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
      includePortalUrl: true,
      portalToken,
      origin,
    }),
    portalToken,
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
    .find({ documentId, documentTenantId: ctx.tenantId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const signatures = await getSignaturesCollection();
  const signatureRows = await signatures
    .find({ documentId, signatureRequestId: { $in: items.map((item) => item.signatureRequestId) } })
    .toArray();
  const signatureByRequest = new Map(signatureRows.map((row) => [row.signatureRequestId, row]));

  return {
    items: items.map((item) => ({
      ...serializeSignatureRequest(item),
      signature: signatureByRequest.has(item.signatureRequestId)
        ? {
            signatureId: signatureByRequest.get(item.signatureRequestId)!.signatureId,
            verificationCode: signatureByRequest.get(item.signatureRequestId)!.verificationCode,
            signedAt: signatureByRequest.get(item.signatureRequestId)!.signedAt.toISOString(),
          }
        : null,
    })),
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
    documentTenantId: ctx.tenantId,
  });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }
  await loadSignableDocument(ctx, user, request.documentId);
  return serializeSignatureRequest(request);
}

export async function getSignaturePortalPayload(token: string) {
  const request = await findSignatureRequestByToken(token);
  if (!request) {
    throw new ServiceError('Convite de assinatura inválido.', 'SIGNATURE_TOKEN_INVALID', 404);
  }
  if (!isRequestOpen(request)) {
    throw new ServiceError('Solicitação de assinatura indisponível.', 'SIGNATURE_REQUEST_CLOSED', 403);
  }

  const collections = await getTenantCollections(request.documentTenantId);
  const doc = await collections.documents.findOne({ _id: request.documentId, ...ACTIVE_DOCUMENT_FILTER });
  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const signer = request.signers[0];
  return {
    signatureRequestId: request.signatureRequestId,
    documentId: request.documentId,
    versionId: request.versionId,
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
  if (!isRequestOpen(request)) {
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

  const collections = await getTenantCollections(request.documentTenantId);
  const doc = await collections.documents.findOne({ _id: request.documentId, ...ACTIVE_DOCUMENT_FILTER });
  const version = await collections.documentVersions.findOne({
    _id: request.versionId,
    documentId: request.documentId,
  });
  if (!doc || !version) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const originalPdfBuffer = await readVersionPdfBuffer({ request, version: version as MongoDocumentVersion });
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
  });

  const storageScope = await resolveTenantStorageScopeById(
    request.documentTenantId,
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
    tenantId: request.documentTenantId,
    objectKey: signedPdfKey,
    buffer: pdfResult.signedPdfBuffer,
    contentType: 'application/pdf',
    bucketAlias: version.storage?.primary?.bucketAlias ?? null,
    storageScope,
  });
  const evidenceStored = await persistPreviewAsset({
    tenantId: request.documentTenantId,
    objectKey: evidenceKey,
    buffer: Buffer.from(JSON.stringify(pdfResult.evidencePayload, null, 2), 'utf8'),
    contentType: 'application/json',
    bucketAlias: version.storage?.primary?.bucketAlias ?? null,
    storageScope,
  });
  if (!signedStored || !evidenceStored) {
    throw new ServiceError('Falha ao persistir artefatos de assinatura.', 'SIGNATURE_STORAGE_FAILED', 500);
  }

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

  await collections.documents.updateOne(
    { _id: request.documentId },
    { $set: { signatureStatus: 'signed', updatedAt: signedAt } },
  );

  return {
    signatureId,
    verificationCode,
    verificationUrl,
    signedAt: signedAt.toISOString(),
    canDownload: request.permissions.canDownloadAfterSign,
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
  if (!request || !isRequestOpen(request)) {
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

  const collections = await getTenantCollections(request.documentTenantId);
  await collections.documents.updateOne(
    { _id: request.documentId },
    { $set: { signatureStatus: 'declined', updatedAt: now } },
  );
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

export async function readSignedPdfForRequest(signatureRequestId: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const signatures = await getSignaturesCollection();
  const signature = await signatures.findOne({ signatureRequestId });
  if (!signature || signature.status !== 'signed') {
    throw new ServiceError('PDF assinado indisponível.', 'SIGNED_PDF_NOT_FOUND', 404);
  }

  const requests = await getSignatureRequestsCollection();
  const request = await requests.findOne({ signatureRequestId });
  if (!request) {
    throw new ServiceError('Solicitação não encontrada.', 'SIGNATURE_REQUEST_NOT_FOUND', 404);
  }

  const storageScope = await resolveTenantStorageScopeById(
    request.documentTenantId,
    request.documentTenantType,
  );
  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const collections = await getTenantCollections(request.documentTenantId);
  const doc = await collections.documents.findOne({ _id: request.documentId });
  const file = await provider.readDocumentVersion(
    signature.signedPdfR2Key,
    request.documentTenantId,
    null,
    storageScope,
  );

  return {
    buffer: file.buffer,
    fileName: `${doc?.currentFileName?.replace(/\.pdf$/i, '') ?? 'documento'}-assinado.pdf`,
  };
}

export function buildSignatureAuditContext(
  request: MongoDocumentSignatureRequest,
  requestId?: string,
): DocumentAuditContext {
  return {
    tenantId: request.documentTenantId,
    tenantType: request.documentTenantType ?? 'business',
    collectionPrefix: request.documentTenantId,
    ownerTenantId: request.documentTenantId,
    ownerUserId: request.requestedByUserId,
    actorUserId: request.requestedByUserId,
    actorDisplayName: request.requestedByNameSnapshot ?? undefined,
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
    signerName: signer?.name,
    signerEmailMasked: signer ? maskEmail(signer.email) : undefined,
    signerEmailHash: signer
      ? hashTrackingValue(signer.email, 'doqyn-signer-email-v1')
      : undefined,
    signerPhoneMasked: signer?.phoneMasked ?? undefined,
    source: 'signature_request',
    ...extra,
  };
}
