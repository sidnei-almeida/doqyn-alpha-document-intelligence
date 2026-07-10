import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import { generateSignedPdf, SIGNATURE_CONSENT_TEXT } from '../server/services/signatures/signaturePdfService.js';
import { resolveSignatureStampPageIndex } from '../server/services/signatures/signaturePdfPageUtils.js';
import {
  computeSignatureStampLayoutAtIndex,
  getSignatureStampStride,
} from '../server/services/signatures/signatureStampLayout.js';
import { hashSignaturePortalToken } from '../server/services/signatures/signatureTokens.js';
import {
  normalizeSignatureSummary,
  signatureSummaryTooltip,
} from '../src/features/signature/utils/signatureSummaryDisplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('document electronic signature — fase 1', () => {
  it('modelo Mongo e coleções globais definidos', () => {
    const constants = read('server/db/constants.ts');
    assert.ok(constants.includes('documentSignatureRequests'));
    assert.ok(constants.includes('documentSignatures'));
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoDocumentSignatureRequest'));
    assert.ok(types.includes('MongoDocumentSignature'));
    assert.ok(types.includes('signatureStatus'));
  });

  it('token de portal é hasheado e nunca persistido em claro no serviço', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(service.includes('signatureTokenHash'));
    assert.ok(service.includes('hashSignaturePortalToken'));
    assert.equal(service.includes('portalToken'), true);
    const hash = hashSignaturePortalToken('sample-token-value');
    assert.equal(hash.length, 64);
    assert.notEqual(hash, 'sample-token-value');
  });

  it('artefatos de assinatura usam path dedicado no R2', () => {
    const keys = read('server/storage/storageKeys.ts');
    assert.ok(keys.includes('buildSignatureArtifactObjectKey'));
    assert.ok(keys.includes('/signatures/'));
    assert.ok(keys.includes('signed.pdf'));
    assert.ok(keys.includes('evidence.json'));
  });

  it('gera PDF assinado com carimbo compacto e certificado', async () => {
    const original = await PDFDocument.create();
    original.addPage();
    const originalBytes = await original.save();

    const result = await generateSignedPdf({
      originalPdfBuffer: Buffer.from(originalBytes),
      documentName: 'Contrato.pdf',
      documentId: 'doc_1',
      versionId: 'ver_1',
      signatureRequestId: 'req_1',
      signatureId: 'sig_1',
      signerName: 'João Silva',
      signerEmailMasked: 'jo***@empresa.com',
      signerPhoneMasked: '+55 54 *****-9999',
      signedAt: new Date('2026-07-09T14:32:00.000Z'),
      verificationCode: 'DOQYN-2026-ABC123',
      verificationUrl: 'http://localhost:5173/verify/signature/DOQYN-2026-ABC123',
      securityContext: {
        ipAddressMasked: '189.45.xxx.xxx',
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop',
        country: 'BR',
        region: 'RS',
        city: 'Caxias do Sul',
      },
    });

    assert.ok(result.signedPdfBuffer.byteLength > originalBytes.byteLength);
    assert.equal(result.originalDocumentHashSha256.length, 64);
    assert.equal(result.signedPdfHashSha256.length, 64);
    assert.notEqual(result.originalDocumentHashSha256, result.signedPdfHashSha256);

    const parsed = await PDFDocument.load(result.signedPdfBuffer);
    assert.equal(parsed.getPageCount(), 2);
  });

  it('promove PDF assinado para nova versão do documento', () => {
    const promote = read('server/services/signatures/promoteSignedPdfToDocumentVersion.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(promote.includes('promoteSignedPdfToDocumentVersion'));
    assert.ok(promote.includes('storeUploadedDocumentFile'));
    assert.ok(promote.includes('generateDocumentPreviewForVersion'));
    assert.ok(promote.includes('currentVersionId'));
    assert.ok(service.includes('promoteSignedPdfToDocumentVersion'));
    assert.ok(service.includes('promotedVersionId'));
  });

  it('empilha carimbos compactos de assinaturas anteriores no rodapé', async () => {
    const original = await PDFDocument.create();
    const page = original.addPage([595, 842]);
    page.drawText('Contrato', { x: 72, y: 760, size: 12 });
    const originalBytes = await original.save();

    const result = await generateSignedPdf({
      originalPdfBuffer: Buffer.from(originalBytes),
      documentName: 'Contrato.pdf',
      documentId: 'doc_1',
      versionId: 'ver_1',
      signatureRequestId: 'req_2',
      signatureId: 'sig_2',
      signerName: 'Maria Costa',
      signerEmailMasked: 'ma***@empresa.com',
      signedAt: new Date('2026-07-10T10:00:00.000Z'),
      verificationCode: 'DOQYN-2026-DEF456',
      verificationUrl: 'http://localhost:5173/verify/signature/DOQYN-2026-DEF456',
      previousStamps: [
        {
          signerName: 'João Silva',
          signedAt: new Date('2026-07-09T14:32:00.000Z'),
          verificationCode: 'DOQYN-2026-ABC123',
        },
      ],
    });

    assert.ok(result.signedPdfBuffer.byteLength > originalBytes.byteLength);
    const service = read('server/services/signatures/signatureStampLayout.ts');
    assert.ok(service.includes('computeSignatureStampLayouts'));
    assert.ok(service.includes('buildCompactStampLines'));
    const pdfService = read('server/services/signatures/signaturePdfService.ts');
    assert.ok(pdfService.includes('previousStamps'));
    assert.ok(pdfService.includes('opacity: 0.72'));
    assert.ok(pdfService.includes('resolveSignatureStampTargetPage'));
    assert.ok(pdfService.includes('completedSignatureCount'));
  });

  it('página do carimbo = total de páginas − assinaturas concluídas', () => {
    assert.equal(resolveSignatureStampPageIndex(5, 0), 4);
    assert.equal(resolveSignatureStampPageIndex(6, 1), 4);
    assert.equal(resolveSignatureStampPageIndex(8, 3), 4);
    const utils = read('server/services/signatures/signaturePdfPageUtils.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(utils.includes('resolveSignatureStampPageIndex'));
    assert.ok(!utils.includes('pdf-parse'));
    assert.ok(service.includes('completedSignatureCount'));
  });

  it('posiciona novo carimbo à direita dos anteriores no rodapé', () => {
    const first = computeSignatureStampLayoutAtIndex(595, 0);
    const second = computeSignatureStampLayoutAtIndex(595, 1);
    const third = computeSignatureStampLayoutAtIndex(595, 2);
    assert.ok(second.x > first.x);
    assert.ok(third.x > second.x);
    assert.equal(second.x - first.x, getSignatureStampStride());
    const pdfService = read('server/services/signatures/signaturePdfService.ts');
    assert.ok(pdfService.includes('computeSignatureStampLayoutAtIndex'));
    assert.ok(pdfService.includes('completedSignatureCount'));
  });

  it('reassina documento já assinado sem carimbar a página de certificado', async () => {
    const original = await PDFDocument.create();
    const page = original.addPage([595, 842]);
    page.drawText('Contrato original', { x: 72, y: 760, size: 12 });
    const originalBytes = await original.save();

    const firstSignature = await generateSignedPdf({
      originalPdfBuffer: Buffer.from(originalBytes),
      documentName: 'Contrato.pdf',
      documentId: 'doc_resign',
      versionId: 'ver_1',
      signatureRequestId: 'req_1',
      signatureId: 'sig_1',
      signerName: 'João Silva',
      signerEmailMasked: 'jo***@empresa.com',
      signedAt: new Date('2026-07-09T14:32:00.000Z'),
      verificationCode: 'DOQYN-2026-ABC123',
      verificationUrl: 'http://localhost:5173/verify/signature/DOQYN-2026-ABC123',
    });

    const secondSignature = await generateSignedPdf({
      originalPdfBuffer: firstSignature.signedPdfBuffer,
      documentName: 'Contrato.pdf',
      documentId: 'doc_resign',
      versionId: 'ver_2',
      signatureRequestId: 'req_2',
      signatureId: 'sig_2',
      signerName: 'Maria Costa',
      signerEmailMasked: 'ma***@empresa.com',
      signedAt: new Date('2026-07-10T10:00:00.000Z'),
      verificationCode: 'DOQYN-2026-DEF456',
      verificationUrl: 'http://localhost:5173/verify/signature/DOQYN-2026-DEF456',
      completedSignatureCount: 1,
    });

    const parsed = await PDFDocument.load(secondSignature.signedPdfBuffer);
    assert.equal(parsed.getPageCount(), 3);

    const parser = new PDFParse({ data: secondSignature.signedPdfBuffer });
    try {
      const textResult = await parser.getText();
      const pages = textResult.pages ?? [];
      assert.equal(pages.length, 3);
      assert.ok(pages[0]?.text?.includes('Contrato original'));
      assert.ok(pages[0]?.text?.includes('João'));
      assert.ok(pages[0]?.text?.includes('Maria'));
      assert.ok(pages[1]?.text?.includes('Certificado de Assinatura'));
      assert.ok(pages[2]?.text?.includes('Certificado de Assinatura'));
      assert.equal(pages[1]?.text?.includes('Maria'), false);
    } finally {
      await parser.destroy();
    }
  });

  it('validador público não expõe e-mail/telefone completo', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');
    const verifyApi = read('api/verify/signature/[verificationCode].ts');
    assert.ok(service.includes('getPublicSignatureVerification'));
    assert.ok(service.includes('signerEmailMasked'));
    assert.ok(service.includes('signerNameMasked'));
    assert.ok(verifyApi.includes('getPublicSignatureVerification'));
  });

  it('endpoints e rotas dev registrados', () => {
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('/signature-requests'));
    assert.ok(devServer.includes('/api/sign/'));
    assert.ok(devServer.includes('/verify/signature/'));
  });

  it('tracking inclui eventos de assinatura', () => {
    const audit = read('server/audit/documentAuditTypes.ts');
    assert.ok(audit.includes('document.signature_request_created'));
    assert.ok(audit.includes('document.signature_completed'));
    assert.ok(audit.includes('document.signed_pdf_generated'));
  });

  it('texto de consentimento é explícito e não menciona ICP-Brasil', () => {
    assert.ok(SIGNATURE_CONSENT_TEXT.includes('DOQYN'));
    assert.equal(/ICP|gov\.br|qualificada/i.test(SIGNATURE_CONSENT_TEXT), false);
  });

  it('UI portal e validador possuem rotas frontend', () => {
    const routes = read('src/app/routes.tsx');
    assert.ok(routes.includes('/guest/sign/:token'));
    assert.ok(routes.includes('/verify/signature/:verificationCode'));
  });

  it('preview de assinatura usa proxy seguro sem expor R2', () => {
    const preview = read('server/services/signatures/documentSignaturePreviewService.ts');
    const previewApi = read('api/sign/[token]/preview.ts');
    assert.equal(preview.includes('presigned'), false);
    assert.equal(preview.includes('signedUrl'), false);
    assert.ok(preview.includes('buildSignaturePreviewBasePath'));
    assert.ok(preview.includes('requireSignaturePortalRequest'));
    assert.ok(previewApi.includes('getSignaturePreviewManifest'));
    assert.ok(previewApi.includes('document.signature_preview_viewed'));
    assert.ok(previewApi.includes('document.signature_viewed'));
  });

  it('preview de assinatura usa versionId da solicitação', () => {
    const preview = read('server/services/signatures/documentSignaturePreviewService.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(preview.includes('loadSignatureRequestDocumentContext'));
    assert.ok(service.includes('request.versionId'));
    assert.ok(preview.includes('assertSignatureManifestVersion'));
  });

  it('preview de assinatura não expõe objectKey ou bucket', () => {
    const preview = read('server/services/signatures/documentSignaturePreviewService.ts');
    const previewApi = read('api/sign/[token]/preview.ts');
    assert.equal(preview.includes('objectKey'), true);
    assert.equal(previewApi.includes('objectKey'), false);
    assert.equal(previewApi.includes('bucket'), false);
    assert.ok(preview.includes('/api/sign/'));
    assert.ok(preview.includes('/pages/'));
  });

  it('endpoints de preview e download assinado registrados no dev-server', () => {
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('/api/sign/'));
    assert.ok(devServer.includes('sign/[token]/preview.js'));
    assert.ok(devServer.includes('sign/[token]/signed-pdf.js'));
  });

  it('portal valida token e bloqueia request fechada', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(service.includes('requireSignaturePortalRequest'));
    assert.ok(service.includes('SIGNATURE_TOKEN_INVALID'));
    assert.ok(service.includes('SIGNATURE_REQUEST_CLOSED'));
    assert.ok(service.includes('ACTIVE_DOCUMENT_FILTER'));
    assert.ok(service.includes('SIGNATURE_VERSION_NOT_FOUND'));
  });

  it('assinatura registra aceite e bloqueia sem consentimento', () => {
    const signApi = read('api/sign/[token]/sign.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(signApi.includes('document.signature_consent_checked'));
    assert.ok(service.includes('SIGNATURE_CONSENT_REQUIRED'));
    assert.ok(service.includes('requireCanSign'));
  });

  it('portal frontend carrega preview e controla aceite', () => {
    const portal = read('src/features/signature/SignaturePortalPage.tsx');
    const api = read('src/features/signature/api/signatureApi.ts');
    const viewer = read('src/features/signature/GuestSignatureViewer.tsx');
    assert.ok(portal.includes('fetchSignaturePreviewManifest'));
    assert.ok(portal.includes('signature-preview-loading'));
    assert.ok(portal.includes('signature-preview-unavailable'));
    assert.ok(portal.includes('signature-consent-checkbox'));
    assert.ok(portal.includes('!canSubmit'));
    assert.ok(portal.includes('signDocumentViaPortal'));
    assert.ok(portal.includes('signature-portal-success'));
    assert.ok(portal.includes('verificationCode'));
    assert.ok(portal.includes('DoqynLogo'));
    assert.equal(portal.includes('Sidebar'), false);
    assert.equal(portal.includes('LibraryPage'), false);
    assert.ok(api.includes('/preview/manifest'));
    assert.ok(viewer.includes('fetchSignaturePreviewAssetBlob'));
    assert.ok(viewer.includes('PreviewAssetFetchProvider'));
  });

  it('listDocuments expõe signatureSummary agregado', () => {
    const listItems = read('server/services/documentListItems.ts');
    const summary = read('server/services/signatures/documentSignatureSummaryService.ts');
    const types = read('src/types/document-library.ts');
    assert.ok(listItems.includes('signatureSummary'));
    assert.ok(listItems.includes('loadSignatureSummariesForDocuments'));
    assert.ok(summary.includes('buildSignatureSummaryFromRequests'));
    assert.ok(summary.includes('hasSignedPdf'));
    assert.ok(types.includes('DocumentSignatureSummary'));
  });

  it('download autenticado de PDF assinado valida acesso e não expõe R2', () => {
    const signedPdfApi = read('api/signature-requests/[signatureRequestId]/signed-pdf.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(signedPdfApi.includes('requireDocumentAuthContext'));
    assert.ok(signedPdfApi.includes('readSignedPdfForAuthenticatedRequest'));
    assert.ok(signedPdfApi.includes('document.signature_downloaded'));
    assert.equal(signedPdfApi.includes('signedPdfR2Key'), false);
    assert.ok(service.includes('ACTIVE_DOCUMENT_FILTER'));
    assert.ok(service.includes('SIGNATURE_DOWNLOAD_DENIED'));
    assert.ok(service.includes('-assinado-'));
  });

  it('getDocumentDetail inclui signatureSummary', () => {
    const service = read('server/services/documentService.ts');
    assert.ok(service.includes('loadDocumentSignatureSummary'));
    assert.ok(service.includes('signatureSummary'));
  });

  it('biblioteca exibe badges e ações de assinatura', () => {
    const card = read('src/features/library/components/files/DocumentFileCard.tsx');
    const row = read('src/features/library/components/files/DocumentFileRow.tsx');
    const badge = read('src/features/library/components/files/DocumentSignatureBadge.tsx');
    const summaryDisplay = read('src/features/signature/utils/signatureSummaryDisplay.ts');
    const summaryService = read('server/services/signatures/documentSignatureSummaryService.ts');
    const menu = read('src/features/library/components/ExplorerContextMenu.tsx');
    const drawer = read('src/features/signature/DocumentSignaturesDrawer.tsx');
    const details = read('src/features/library/components/OptionalDetailsDrawer.tsx');
    const page = read('src/features/library/LibraryPage.tsx');
    const api = read('src/features/signature/api/signatureApi.ts');
    assert.ok(card.includes('DocumentSignatureBadge'));
    assert.ok(row.includes('DocumentSignatureBadge'));
    assert.ok(badge.includes('signatureSummaryBadgeLabel'));
    assert.ok(badge.includes('document-signature-badge-button'));
    assert.ok(summaryDisplay.includes('signedSigners'));
    assert.ok(summaryService.includes('signedSigners'));
    assert.ok(menu.includes('Ver assinaturas'));
    assert.ok(menu.includes('Baixar PDF assinado'));
    assert.ok(menu.includes('disabled={!canShare}'));
    assert.ok(drawer.includes('document-signatures-drawer'));
    assert.ok(drawer.includes('document-signatures-drawer-close'));
    assert.ok(drawer.includes('WorkspaceSideDrawer'));
    assert.ok(drawer.includes('TruncatedText'));
    assert.ok(drawer.includes('verificationCode'));
    assert.ok(drawer.includes('signature-drawer-revoke'));
    assert.ok(drawer.includes('cancelDocumentSignatureRequest'));
    assert.ok(drawer.includes('buildRevokeSignatureRequestConfirm'));
    assert.ok(details.includes('Assinatura'));
    assert.ok(page.includes('DocumentSignaturesDrawer'));
    assert.ok(page.includes('downloadSignatureRequestSignedPdf'));
    assert.ok(api.includes('/signature-requests/'));
  });

  it('sincroniza status após assinatura sem exigir F5', () => {
    const sync = read('src/features/signature/utils/signatureCompletionSync.ts');
    const hook = read('src/features/signature/hooks/useSignatureCompletionSync.ts');
    const portal = read('src/features/signature/SignaturePortalPage.tsx');
    const internal = read('src/features/signature/InternalSignaturePage.tsx');
    const documentsHook = read('src/features/documents/hooks/useDocuments.ts');
    const layout = read('src/app/layout/WorkspaceLayout.tsx');
    assert.ok(sync.includes('publishSignatureCompleted'));
    assert.ok(sync.includes('subscribeSignatureCompleted'));
    assert.ok(hook.includes('invalidateSignatureQueries'));
    assert.ok(portal.includes('publishSignatureCompleted'));
    assert.ok(internal.includes('publishSignatureCompleted'));
    assert.ok(documentsHook.includes('documentHasPendingSignature'));
    assert.ok(documentsHook.includes('refetchInterval'));
    assert.ok(layout.includes('useSignatureCompletionSync'));
  });

  it('normaliza signatureSummary legado sem signedSigners', () => {
    const normalized = normalizeSignatureSummary({
      status: 'signed',
      pendingCount: 0,
      signedCount: 1,
      hasSignedPdf: true,
    } as never);
    assert.ok(normalized);
    assert.deepEqual(normalized?.signedSigners, []);
    assert.equal(signatureSummaryTooltip(normalized), null);
  });

  it('revoga solicitações pendentes via API e drawer', () => {
    const cancelApi = read('api/signature-requests/[signatureRequestId]/cancel.ts');
    const nestedCancelApi = read(
      'api/documents/[documentId]/signature-requests/[signatureRequestId]/cancel.ts',
    );
    const signatureApi = read('src/features/signature/api/signatureApi.ts');
    const statusUtils = read('server/services/signatures/signatureRequestStatus.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    const confirmMessages = read('src/components/confirm/confirmMessages.ts');
    const tracking = read('src/features/tracking/utils/trackingDisplay.ts');
    const audit = read('server/audit/documentAuditTypes.ts');
    assert.ok(cancelApi.includes('cancelDocumentSignatureRequest'));
    assert.ok(nestedCancelApi.includes('expectedDocumentId'));
    assert.ok(signatureApi.includes('/signature-requests/${encodeURIComponent(signatureRequestId)}/cancel'));
    assert.ok(statusUtils.includes('resolveEffectiveSignatureRequestStatus'));
    assert.ok(cancelApi.includes('document.signature_request_cancelled'));
    assert.ok(service.includes('export async function cancelDocumentSignatureRequest'));
    assert.ok(service.includes("status: 'cancelled'"));
    assert.ok(service.includes('signatureTokenHash: null'));
    assert.ok(confirmMessages.includes('buildRevokeSignatureRequestConfirm'));
    assert.ok(tracking.includes('document.signature_request_cancelled'));
    assert.ok(audit.includes('document.signature_request_cancelled'));
  });
});

describe('document electronic signature — alinhamento com compartilhamento', () => {
  it('modelo de signatário suporta internal_user e external_guest', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('internal_user'));
    assert.ok(types.includes('external_guest'));
    assert.ok(types.includes('canViewForSigning'));
    assert.ok(types.includes('canDownloadSignedPdf'));
  });

  it('validação de signatário interno usa membros ativos do tenant', () => {
    const validation = read('server/services/signatures/signatureRecipientValidation.ts');
    assert.ok(validation.includes('resolveInternalSignerForTenant'));
    assert.ok(validation.includes('SIGNER_SELF_FORBIDDEN'));
    assert.ok(validation.includes('SIGNER_NOT_ACTIVE'));
    assert.ok(validation.includes('serializeTenantMember'));
  });

  it('serviço diferencia portal externo e assinatura interna', () => {
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(service.includes('requireSignaturePortalRequest'));
    assert.ok(service.includes('requireAssignedInternalSignatureRequest'));
    assert.ok(service.includes('listSignatureRequestsAssignedToMe'));
    assert.ok(service.includes('getInternalSignatureSigningPayload'));
    assert.ok(service.includes('userHasSignatureDocumentAccess'));
  });

  it('endpoints internos assigned-to-me, signing-payload, preview e sign', () => {
    const assigned = read('api/signature-requests/assigned-to-me.ts');
    const payload = read('api/signature-requests/[signatureRequestId]/signing-payload.ts');
    const preview = read('api/signature-requests/[signatureRequestId]/preview.ts');
    const sign = read('api/signature-requests/[signatureRequestId]/sign.ts');
    const devServer = read('server/dev-server.ts');
    assert.ok(assigned.includes('listSignatureRequestsAssignedToMe'));
    assert.ok(payload.includes('getInternalSignatureSigningPayload'));
    assert.ok(preview.includes('getInternalSignaturePreviewManifest'));
    assert.ok(sign.includes('completeDocumentSignature'));
    assert.ok(devServer.includes('assigned-to-me'));
    assert.ok(devServer.includes('signing-payload'));
  });

  it('tracking diferencia eventos interno e externo', () => {
    const audit = read('server/audit/documentAuditTypes.ts');
    const api = read('api/documents/[documentId]/signature-requests.ts');
    const portal = read('api/sign/[token]/index.ts');
    const service = read('server/services/signatures/documentSignatureService.ts');
    assert.ok(audit.includes('document.signature_internal_assigned'));
    assert.ok(audit.includes('document.signature_internal_opened'));
    assert.ok(audit.includes('document.signature_external_invite_created'));
    assert.ok(audit.includes('document.signature_external_opened'));
    assert.ok(api.includes('document.signature_internal_assigned'));
    assert.ok(api.includes('document.signature_external_invite_created'));
    assert.ok(portal.includes('document.signature_external_opened'));
    assert.ok(portal.includes('buildExternalSignatureAuditContext'));
    assert.ok(service.includes('buildExternalSignatureAuditContext'));
    assert.ok(service.includes('signerType: signer?.signerType'));
  });

  it('rotas do portal externo registram tracking com signatário convidado', () => {
    const preview = read('api/sign/[token]/preview.ts');
    const sign = read('api/sign/[token]/sign.ts');
    const download = read('api/sign/[token]/signed-pdf.ts');
    for (const source of [preview, sign, download]) {
      assert.ok(source.includes('buildExternalSignatureAuditContext'));
      assert.ok(source.includes("authMethod: 'signature_token'"));
      assert.ok(source.includes('isExternalGuest: true'));
    }
    assert.ok(sign.includes('document.signature_completed'));
    assert.ok(sign.includes('document.signed_pdf_generated'));
    assert.ok(sign.includes("source: 'signature_portal'"));
  });

  it('modal Solicitar assinatura tem abas como compartilhamento', () => {
    const modal = read('src/features/signature/RequestSignatureModal.tsx');
    assert.ok(modal.includes('request-signature-tabs'));
    assert.ok(modal.includes('request-signature-tab-internal'));
    assert.ok(modal.includes('request-signature-tab-external'));
    assert.ok(modal.includes('Pessoas da empresa'));
    assert.ok(modal.includes('Convidados externos'));
    assert.ok(modal.includes('useShareableUsersSearch'));
  });

  it('criação interna envia signerType internal_user e signerUserId', () => {
    const modal = read('src/features/signature/RequestSignatureModal.tsx');
    const api = read('src/features/signature/api/signatureApi.ts');
    assert.ok(modal.includes("signerType: 'internal_user'"));
    assert.ok(modal.includes('signerUserId: selectedUser.userId'));
    assert.ok(api.includes('signerUserId'));
  });

  it('criação externa envia signerType external_guest', () => {
    const modal = read('src/features/signature/RequestSignatureModal.tsx');
    assert.ok(modal.includes("signerType: 'external_guest'"));
    assert.ok(modal.includes('canDownloadAfterSign'));
    assert.ok(modal.includes('ExternalInviteLinkField'));
    assert.ok(modal.includes('request-signature-portal-url'));
    assert.ok(modal.includes('Compartilhe o link abaixo com o signatário'));
  });

  it('página Para assinar lista solicitações assigned-to-me', () => {
    const collections = read('src/features/library/collections.ts');
    const constants = read('src/lib/constants.ts');
    const panel = read('src/features/signature/components/SignaturesAssignedPanel.tsx');
    const hook = read('src/features/signature/hooks/useAssignedSignatureRequests.ts');
    const page = read('src/features/library/LibraryPage.tsx');
    assert.ok(collections.includes('para-assinar'));
    assert.ok(collections.includes("slug: 'assinaturas'"));
    assert.ok(constants.includes('Para assinar'));
    assert.ok(panel.includes('signatures-assigned-list'));
    assert.ok(hook.includes('fetchAssignedSignatureRequests'));
    assert.ok(page.includes('SignaturesAssignedPanel'));
    assert.ok(page.includes('isSignaturesView'));
  });

  it('assinatura interna autenticada com preview e rota dedicada', () => {
    const internal = read('src/features/signature/InternalSignaturePage.tsx');
    const viewer = read('src/features/signature/InternalSignatureViewer.tsx');
    const api = read('src/features/signature/api/signatureApi.ts');
    const routes = read('src/app/routes.tsx');
    assert.ok(internal.includes('fetchInternalSignatureSigningPayload'));
    assert.ok(internal.includes('signDocumentViaRequest'));
    assert.ok(viewer.includes('fetchInternalSignaturePreviewAssetBlob'));
    assert.ok(api.includes('/api/signature-requests/assigned-to-me'));
    assert.ok(routes.includes('/assinaturas/:signatureRequestId'));
  });

  it('portal externo permanece isolado sem sidebar', () => {
    const portal = read('src/features/signature/SignaturePortalPage.tsx');
    const routes = read('src/app/routes.tsx');
    assert.ok(routes.includes('/guest/sign/:token'));
    assert.equal(portal.includes('Sidebar'), false);
    assert.equal(portal.includes('AppLayout'), false);
  });
});
