import {
  buildExternalShareInvitePath,
  getExternalSharePortalPayload,
  resolveExternalShareAccess,
} from '../services/sharing/externalDocumentShareService.js';
import {
  buildSignaturePortalPath,
  findSignatureRequestByToken,
  getSignaturePortalPayload,
  loadSignatureRequestDocumentContext,
} from '../services/signatures/documentSignatureService.js';
import { isSignatureRequestOpen } from '../services/signatures/signatureRequestStatus.js';
import { toAbsolutePublicUrl } from '../utils/publicAppUrl.js';

export type OgPortalKind = 'share' | 'sign';

export type OgPortalMetadata = {
  kind: OgPortalKind;
  available: boolean;
  title: string;
  description: string;
  documentName?: string;
  issuerName?: string;
  ownerTenantName?: string;
  versionLabel?: string | null;
  statusLabel?: string;
  imageUrl: string;
  canonicalUrl: string;
  portalPath: string;
  ctaLabel: string;
};

function buildShareImageUrl(origin: string, token: string, canUseDocumentPreview: boolean): string {
  if (!canUseDocumentPreview) {
    return toAbsolutePublicUrl(origin, '/og/portal-default.webp');
  }
  return toAbsolutePublicUrl(
    origin,
    `/api/og/guest/share/${encodeURIComponent(token)}/image`,
  );
}

function buildSignImageUrl(origin: string, token: string): string {
  return toAbsolutePublicUrl(origin, `/api/og/guest/sign/${encodeURIComponent(token)}/image`);
}

function unavailableMetadata(input: {
  kind: OgPortalKind;
  origin: string;
  token: string;
  portalPath: string;
  reason?: string;
}): OgPortalMetadata {
  const isSign = input.kind === 'sign';
  return {
    kind: input.kind,
    available: false,
    title: isSign ? 'Assinatura indisponível · DOQYN' : 'Compartilhamento indisponível · DOQYN',
    description:
      input.reason ??
      (isSign
        ? 'Este link de assinatura expirou, foi revogado ou não é mais válido.'
        : 'Este link de compartilhamento expirou, foi revogado ou não é mais válido.'),
    imageUrl: toAbsolutePublicUrl(input.origin, '/og/portal-default.webp'),
    canonicalUrl: toAbsolutePublicUrl(input.origin, input.portalPath),
    portalPath: input.portalPath,
    ctaLabel: isSign ? 'Tentar abrir' : 'Tentar abrir',
    statusLabel: 'Indisponível',
  };
}

export async function getShareOgMetadata(token: string, origin: string): Promise<OgPortalMetadata> {
  const portalPath = buildExternalShareInvitePath(token);
  const access = await resolveExternalShareAccess(token);

  if (!access.grant) {
    return unavailableMetadata({
      kind: 'share',
      origin,
      token,
      portalPath,
      reason:
        access.reason === 'not_found'
          ? 'Convite não encontrado ou link inválido.'
          : access.reason === 'revoked'
            ? 'Este compartilhamento foi revogado pelo remetente.'
            : access.reason === 'expired' || access.reason === 'invite_expired'
              ? 'Este convite expirou.'
              : undefined,
    });
  }

  try {
    const payload = await getExternalSharePortalPayload(token);
    const canUseDocumentPreview =
      payload.status === 'active' && Boolean(payload.permissions?.canView);
    const documentName = payload.document.displayName;
    const versionSuffix = payload.document.versionLabel
      ? ` · ${payload.document.versionLabel}`
      : '';

    const title = `${documentName}${versionSuffix} · DOQYN`;
    const description = [
      payload.status === 'pending'
        ? `${payload.sharedByName} convidou você a acessar um documento em ${payload.ownerTenantName}.`
        : `${payload.sharedByName} compartilhou um documento com você via ${payload.ownerTenantName}.`,
      payload.message ? `“${payload.message.trim()}”` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      kind: 'share',
      available: true,
      title,
      description,
      documentName,
      issuerName: payload.sharedByName,
      ownerTenantName: payload.ownerTenantName,
      versionLabel: payload.document.versionLabel,
      statusLabel: payload.status === 'pending' ? 'Aguardando aceite' : 'Documento compartilhado',
      imageUrl: buildShareImageUrl(origin, token, canUseDocumentPreview),
      canonicalUrl: toAbsolutePublicUrl(origin, portalPath),
      portalPath,
      ctaLabel: payload.status === 'pending' ? 'Aceitar e abrir' : 'Abrir documento',
    };
  } catch {
    return unavailableMetadata({ kind: 'share', origin, token, portalPath });
  }
}

export async function getSignOgMetadata(token: string, origin: string): Promise<OgPortalMetadata> {
  const portalPath = buildSignaturePortalPath(token);
  const request = await findSignatureRequestByToken(token);

  if (!request) {
    return unavailableMetadata({
      kind: 'sign',
      origin,
      token,
      portalPath,
      reason: 'Solicitação de assinatura não encontrada.',
    });
  }

  if (!isSignatureRequestOpen(request)) {
    return unavailableMetadata({
      kind: 'sign',
      origin,
      token,
      portalPath,
      reason: 'Esta solicitação de assinatura já foi concluída, expirou ou foi cancelada.',
    });
  }

  try {
    const payload = await getSignaturePortalPayload(token);
    const { doc } = await loadSignatureRequestDocumentContext(request);
    const documentName = payload.documentName || doc.currentFileName || doc.title;
    const versionSuffix = payload.versionLabel ? ` · ${payload.versionLabel}` : '';

    const title = `Assinar: ${documentName}${versionSuffix} · DOQYN`;
    const description = [
      `${payload.issuerName} solicitou sua assinatura neste documento.`,
      payload.message ? `“${payload.message.trim()}”` : null,
      payload.expiresAt
        ? `Válido até ${new Date(payload.expiresAt).toLocaleString('pt-BR')}.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      kind: 'sign',
      available: true,
      title,
      description,
      documentName,
      issuerName: payload.issuerName,
      versionLabel: payload.versionLabel,
      statusLabel: 'Assinatura pendente',
      imageUrl: buildSignImageUrl(origin, token),
      canonicalUrl: toAbsolutePublicUrl(origin, portalPath),
      portalPath,
      ctaLabel: 'Abrir e assinar',
    };
  } catch {
    return unavailableMetadata({ kind: 'sign', origin, token, portalPath });
  }
}
