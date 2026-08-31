import {
  buildExternalShareInvitePath,
  getExternalSharePortalPayload,
  resolveExternalShareAccess,
} from '../services/sharing/externalDocumentShareService.js';
import {
  buildSignaturePortalPath,
  findSignatureRequestByToken,
  getSignaturePortalPayload,
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

/**
 * O cartão do link não fala do documento — nem em imagem, nem em título, nem em descrição.
 *
 * O robô que monta a prévia não se autentica, e o resultado dele fica visível para todo o grupo
 * onde o link for colado, cacheado por quem o buscou. Antes daqui saía o preview da primeira
 * página, mais o nome do arquivo e a mensagem do remetente — e a mesma lista de user-agents
 * inclui `googlebot`, então isso também era candidato a índice de busca. Um NDA anunciava as
 * partes antes de alguém abrir o link.
 *
 * O que o cartão diz é o que o destinatário já sabe por ter recebido o link: existe um documento
 * esperando por ele, e é do DOQYN. O resto está atrás do portal, que autentica.
 */
function cardImageUrl(origin: string, kind: OgPortalKind): string {
  return toAbsolutePublicUrl(
    origin,
    kind === 'sign' ? '/og/portal-card-sign.png' : '/og/portal-card-share.png',
  );
}

const GENERIC_TITLE: Record<OgPortalKind, string> = {
  sign: 'Documento para assinar · DOQYN',
  share: 'Documento compartilhado · DOQYN',
};

const GENERIC_DESCRIPTION: Record<OgPortalKind, string> = {
  sign: 'Alguém solicitou sua assinatura em um documento. Abra o link para ver e assinar.',
  share: 'Um documento foi compartilhado com você. Abra o link para acessar.',
};

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
    // `reason` continua sendo usado pela página que o robô recebe; fora dela, a meta description
    // é genérica: "revogado pelo remetente" e "expirou" contam história sobre o documento para
    // quem só viu o link passar num grupo.
    description: isSign
      ? 'Este link de assinatura não está mais disponível.'
      : 'Este link de compartilhamento não está mais disponível.',
    imageUrl: cardImageUrl(input.origin, input.kind),
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
    // O payload ainda é buscado porque é ele que prova que o convite existe e está de pé — mas
    // nada do que ele carrega sobre o documento entra no cartão.
    const payload = await getExternalSharePortalPayload(token);

    return {
      kind: 'share',
      available: true,
      title: GENERIC_TITLE.share,
      description: GENERIC_DESCRIPTION.share,
      statusLabel: payload.status === 'pending' ? 'Aguardando aceite' : 'Documento compartilhado',
      imageUrl: cardImageUrl(origin, 'share'),
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
    // Buscado para confirmar que a solicitação está aberta e o token vale. O conteúdo do
    // documento não atravessa daqui para o cartão.
    await getSignaturePortalPayload(token);

    return {
      kind: 'sign',
      available: true,
      title: GENERIC_TITLE.sign,
      description: GENERIC_DESCRIPTION.sign,
      statusLabel: 'Assinatura pendente',
      imageUrl: cardImageUrl(origin, 'sign'),
      canonicalUrl: toAbsolutePublicUrl(origin, portalPath),
      portalPath,
      ctaLabel: 'Abrir e assinar',
    };
  } catch {
    return unavailableMetadata({ kind: 'sign', origin, token, portalPath });
  }
}
