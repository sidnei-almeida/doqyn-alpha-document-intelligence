import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  generateExternalShareInviteToken,
  hashExternalShareToken,
} from '../server/services/sharing/externalShareTokens.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('document external sharing — modelo Mongo', () => {
  it('external_document_share_grants em SHARED_APP_COLLECTIONS', () => {
    const constants = read('server/db/constants.ts');
    assert.ok(constants.includes("externalDocumentShareGrants: 'external_document_share_grants'"));
  });

  it('MongoExternalDocumentShareGrant inclui token hash e status externo', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoExternalDocumentShareGrant'));
    assert.ok(types.includes('inviteTokenHash'));
    assert.ok(types.includes("status: ExternalDocumentShareGrantStatus"));
    assert.ok(types.includes('recipientPhoneNormalized'));
    assert.ok(types.includes('recipientPhoneMasked'));
  });

  it('índice único parcial por documentId + recipientEmail', () => {
    const indexes = read('server/db/externalDocumentShareGrantsIndexes.ts');
    assert.ok(indexes.includes('documentId_recipientEmail_active_pending_unique'));
    assert.ok(indexes.includes("status: { $in: ['active', 'pending'] }"));
    assert.ok(indexes.includes('inviteTokenHash: 1'));
  });
});

describe('document external sharing — segurança', () => {
  it('token é gerado e armazenado apenas como hash', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    assert.ok(service.includes('hashExternalShareToken'));
    assert.ok(service.includes('inviteTokenHash'));
    assert.equal(service.includes('inviteToken:'), false);
  });

  it('hashExternalShareToken é determinístico e não persiste token puro', () => {
    const token = generateExternalShareInviteToken();
    assert.ok(token.length >= 32);
    const hash = hashExternalShareToken(token);
    assert.equal(hash, hashExternalShareToken(token));
    assert.notEqual(hash, token);
  });

  it('serviço não altera R2 nem documentId', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    assert.equal(service.includes('copyObject'), false);
    assert.equal(service.includes('deleteObject'), false);
    assert.ok(service.includes('documentId'));
    assert.ok(service.includes('currentVersionId'));
  });

  it('preview/download externo usa proxy sem presigned URL', () => {
    const preview = read('server/services/sharing/externalDocumentSharePreviewService.ts');
    const downloadApi = read('api/external-shares/[token]/download.ts');
    assert.equal(preview.includes('presigned'), false);
    assert.equal(preview.includes('signedUrl'), false);
    assert.ok(preview.includes('readVersionFileBuffer'));
    assert.ok(downloadApi.includes('Cache-Control'));
  });

  it('documento na lixeira bloqueia acesso externo', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const preview = read('server/services/sharing/externalDocumentSharePreviewService.ts');
    assert.ok(service.includes('isExternalShareDocumentAvailable'));
    assert.ok(preview.includes('ACTIVE_DOCUMENT_FILTER'));
  });
});

describe('document external sharing — API e ACL', () => {
  it('endpoints internos e públicos de external share', () => {
    assert.ok(read('api/documents/[documentId]/external-shares.ts').includes('createDocumentExternalShareGrant'));
    assert.ok(read('api/documents/[documentId]/external-shares/[shareId].ts').includes('revokeDocumentExternalShareGrant'));
    assert.ok(
      read('api/documents/[documentId]/external-shares/[shareId]/regenerate-invite.ts').includes(
        'regenerateDocumentExternalShareGrant',
      ),
    );
    assert.ok(read('api/external-shares/[token]/accept.ts').includes('acceptExternalShareInvite'));
    assert.ok(read('api/external-shares/[token]/document.ts').includes('getExternalShareDocumentDetail'));
    assert.ok(read('api/external-shares/[token]/preview.ts').includes('getExternalSharePreviewManifest'));
    assert.ok(read('api/external-shares/[token]/download.ts').includes('readExternalShareDocumentDownload'));
  });

  it('dev-server registra rotas externas', () => {
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('external-shares'));
    assert.ok(devServer.includes('external-shares/[token]/preview.js'));
    assert.ok(devServer.includes('regenerate-invite.js'));
  });

  it('criação exige permissão de compartilhar documento', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    assert.ok(service.includes('canUserShareDocument'));
    assert.ok(service.includes('DOCUMENT_EXTERNAL_SHARE_DENIED'));
  });

  it('renovar gera novo token e reabre convite como pending', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const regenerateFn = service.slice(
      service.indexOf('export async function regenerateDocumentExternalShareGrant'),
      service.indexOf('export type ExternalShareAccessResult'),
    );
    assert.ok(regenerateFn.includes('generateExternalShareInviteToken'));
    assert.ok(regenerateFn.includes("status: 'pending'"));
    assert.ok(regenerateFn.includes('acceptedAt: null'));
    assert.ok(regenerateFn.includes('revokedAt: null'));
  });

  it('download externo respeita canDownload', () => {
    const preview = read('server/services/sharing/externalDocumentSharePreviewService.ts');
    assert.ok(preview.includes('EXTERNAL_SHARE_DOWNLOAD_DENIED'));
    assert.ok(preview.includes('canDownload'));
  });
});

describe('document external sharing — tracking', () => {
  it('ações de tracking externo definidas', () => {
    const types = read('server/audit/documentAuditTypes.ts');
    assert.ok(types.includes('document.external_share_created'));
    assert.ok(types.includes('document.external_share_invite_opened'));
    assert.ok(types.includes('document.external_share_accepted'));
    assert.ok(types.includes('document.external_share_viewed'));
    assert.ok(types.includes('document.external_share_downloaded'));
    assert.ok(types.includes('document.external_share_revoked'));
    assert.ok(types.includes('document.external_share_denied'));
  });

  it('metadata não inclui token nem objectKey', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const sanitize = read('server/utils/sanitizeAuditMetadata.ts');
    assert.ok(service.includes('recipientEmailHash'));
    assert.ok(service.includes('maskRecipientEmail'));
    assert.ok(sanitize.includes('signedUrl'));
  });
});

describe('document external sharing — ativação do convite', () => {
  it('GET não chama accept e registra invite_opened', () => {
    const getHandler = read('api/external-shares/[token].ts');
    assert.equal(getHandler.includes('acceptExternalShareInvite'), false);
    assert.ok(getHandler.includes("req.method !== 'GET'"));
    assert.ok(getHandler.includes('document.external_share_invite_opened'));
    assert.equal(getHandler.includes('document.external_share_accepted'), false);
  });

  it('GET não altera status no serviço de portal', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const portalFn = service.slice(
      service.indexOf('export async function getExternalSharePortalPayload'),
      service.indexOf('export function buildExternalShareTrackingMetadata'),
    );
    assert.equal(portalFn.includes('status: \'active\''), false);
    assert.equal(portalFn.includes('touchAccess: true'), false);
    assert.ok(portalFn.includes('status: grant.status'));
  });

  it('POST accept é rota dedicada e registra accepted', () => {
    const acceptHandler = read('api/external-shares/[token]/accept.ts');
    assert.ok(acceptHandler.includes('acceptExternalShareInvite'));
    assert.ok(acceptHandler.includes('document.external_share_accepted'));
    assert.ok(acceptHandler.includes("req.method !== 'POST'"));
    const devServer = read('server/dev-server.ts');
    assert.ok(devServer.includes('external-shares/[token]/accept.js'));
  });

  it('accept altera apenas grants pending com update condicional', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const acceptFn = service.slice(
      service.indexOf('export async function acceptExternalShareInvite'),
      service.indexOf('function mapExternalShareDenial'),
    );
    assert.ok(acceptFn.includes("status: 'pending'"));
    assert.ok(acceptFn.includes("status: 'active'"));
    assert.ok(acceptFn.includes('alreadyAccepted'));
    assert.ok(acceptFn.includes('modifiedCount'));
  });

  it('revogado/expirado não passa por resolveExternalShareAccess para accept', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    assert.ok(service.includes("grant.status === 'revoked'"));
    assert.ok(service.includes("grant.status === 'expired'"));
    assert.ok(service.includes('mapExternalShareDenial'));
  });

  it('portal não autoaceita no carregamento', () => {
    const portal = read('src/features/external-share/ExternalSharePortalPage.tsx');
    assert.equal(portal.includes('if (payload.status === \'pending\') {\n          await acceptExternalShareInvite'), false);
    assert.ok(portal.includes('external-share-accept'));
    assert.ok(portal.includes("payload.status === 'active'"));
  });

  it('cliente chama POST /accept e não POST na raiz do token', () => {
    const api = read('src/features/sharing/api/externalShareApi.ts');
    assert.ok(api.includes('/accept'));
    assert.equal(api.includes('`/api/external-shares/${encoded}`, { method: \'POST\' }'), false);
  });
});

describe('document external sharing — UI', () => {
  it('modal de compartilhar tem abas interna e externa', () => {
    const modal = read('src/features/sharing/components/ShareDocumentModal.tsx');
    assert.ok(modal.includes('Pessoas da empresa'));
    assert.ok(modal.includes('Convidados externos'));
    assert.ok(modal.includes('share-tab-internal'));
    assert.ok(modal.includes('share-tab-external'));
    assert.ok(modal.includes('external-share-email'));
    assert.ok(modal.includes('external-share-can-download'));
    assert.ok(modal.includes('ExternalInviteLinkField'));
    assert.ok(modal.includes('external-share-invite-url'));
    assert.ok(modal.includes('Compartilhe o link abaixo com o convidado'));
  });

  it('modal externo expõe badges de revogar e renovar com tooltip', () => {
    const modal = read('src/features/sharing/components/ShareDocumentModal.tsx');
    const api = read('src/features/sharing/api/externalShareApi.ts');
    const hooks = read('src/features/sharing/hooks/useExternalShareMutations.ts');
    assert.ok(modal.includes('ExternalShareActionBadge'));
    assert.ok(modal.includes('Renovar'));
    assert.ok(modal.includes('Revogar'));
    assert.ok(modal.includes('regenerateExternalShare'));
    assert.ok(api.includes('regenerate-invite'));
    assert.ok(hooks.includes('regenerateExternalShare'));
  });

  it('portal externo sem sidebar interna', () => {
    const portal = read('src/features/external-share/ExternalSharePortalPage.tsx');
    const routes = read('src/app/routes.tsx');
    assert.ok(portal.includes('external-share-portal'));
    assert.ok(portal.includes('DoqynLogo'));
    assert.equal(portal.includes('Sidebar'), false);
    assert.equal(portal.includes('AppLayout'), false);
    assert.ok(routes.includes('/guest/share/:token'));
  });

  it('usePreviewAsset aceita fetch alternativo via contexto', () => {
    const context = read('src/features/documents/viewer/PreviewAssetFetchContext.tsx');
    const hook = read('src/features/documents/viewer/usePreviewAsset.ts');
    assert.ok(context.includes('PreviewAssetFetchProvider'));
    assert.ok(hook.includes('usePreviewAssetFetch'));
  });

  it('portal renderiza visualizador interno reutilizado para convidado', () => {
    const portal = read('src/features/external-share/ExternalSharePortalPage.tsx');
    const guestViewer = read('src/features/external-share/GuestDocumentViewer.tsx');
    assert.ok(portal.includes('GuestDocumentViewer'));
    assert.ok(guestViewer.includes('DocumentViewerFrame'));
    assert.ok(guestViewer.includes('resolveViewerComponent'));
    assert.ok(guestViewer.includes('PreviewAssetFetchProvider'));
    assert.ok(guestViewer.includes('fetchExternalShareAssetBlob'));
  });

  it('botão baixar depende de canDownload no portal', () => {
    const guestViewer = read('src/features/external-share/GuestDocumentViewer.tsx');
    assert.ok(guestViewer.includes('permissions.canDownload'));
    assert.ok(guestViewer.includes('Download indisponível neste convite'));
  });
});

describe('document external sharing — telefone do convidado', () => {
  it('service persiste e serializa telefone mascarado', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const serializeFn = service.slice(
      service.indexOf('function serializeExternalShareGrant'),
      service.indexOf('export async function createDocumentExternalShareGrant'),
    );
    assert.ok(service.includes('parseOptionalRecipientPhone'));
    assert.ok(service.includes('recipientPhoneNormalized'));
    assert.ok(serializeFn.includes('recipientPhoneMasked'));
    assert.equal(serializeFn.includes('recipientPhoneNormalized'), false);
    assert.equal(serializeFn.includes('recipientPhone:'), false);
  });

  it('criação aceita recipientPhone no payload da API', () => {
    const api = read('api/documents/[documentId]/external-shares.ts');
    assert.ok(api.includes('recipientPhone'));
  });

  it('tracking não inclui telefone completo', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const api = read('api/documents/[documentId]/external-shares.ts');
    const sanitize = read('server/utils/sanitizeAuditMetadata.ts');
    assert.ok(service.includes('recipientPhoneHash'));
    assert.ok(service.includes('recipientPhoneMasked'));
    assert.ok(api.includes('recipientPhoneMasked'));
    assert.ok(sanitize.includes('recipientphonenormalized'));
    assert.equal(service.includes('recipientPhone: grant.recipientPhone'), false);
  });

  it('endpoint público não expõe telefone', () => {
    const service = read('server/services/sharing/externalDocumentShareService.ts');
    const portalFn = service.slice(
      service.indexOf('export async function getExternalSharePortalPayload'),
      service.indexOf('export function buildExternalShareTrackingMetadata'),
    );
    assert.equal(portalFn.includes('recipientPhone'), false);
    assert.equal(portalFn.includes('recipientPhoneNormalized'), false);
  });

  it('formulário externo coleta telefone opcional com WhatsappInput', () => {
    const modal = read('src/features/sharing/components/ShareDocumentModal.tsx');
    const api = read('src/features/sharing/api/externalShareApi.ts');
    const hooks = read('src/features/sharing/hooks/useExternalShareMutations.ts');
    assert.ok(modal.includes('WhatsappInput'));
    assert.ok(modal.includes('Telefone / WhatsApp'));
    assert.ok(modal.includes('external-share-phone'));
    assert.ok(modal.includes('recipientPhone'));
    assert.ok(modal.includes('isCompleteWhatsapp'));
    assert.ok(modal.includes('recipientPhoneMasked'));
    assert.ok(api.includes('recipientPhone'));
    assert.ok(hooks.includes('recipientPhone'));
  });

  it('portal externo não exibe telefone', () => {
    const portal = read('src/features/external-share/ExternalSharePortalPage.tsx');
    assert.equal(portal.includes('recipientPhone'), false);
    assert.equal(portal.includes('Telefone'), false);
    assert.equal(portal.includes('WhatsApp'), false);
  });
});
