import { getServerT, normalizeServerLocale, type ServerLocale } from '../i18n/index.js';
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
  /** Idioma do cartão. Ausente, pt-BR. */
  locale?: ServerLocale;
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
// A prévia fica em cache no aparelho de quem já colou o link, e o robô não rebusca a imagem
// enquanto a URL dela não mudar. Suba esta versão sempre que o desenho do cartão mudar.
const CARD_VERSION = '2';

function cardImageUrl(origin: string, kind: OgPortalKind): string {
  return toAbsolutePublicUrl(
    origin,
    kind === 'sign'
      ? `/og/portal-card-sign.png?v=${CARD_VERSION}`
      : `/og/portal-card-share.png?v=${CARD_VERSION}`,
  );
}

/**
 * Indisponível, sem dizer por quê: "revogado pelo remetente" e "expirou" contam história sobre o
 * documento para quem só viu o link passar num grupo.
 */
function unavailableMetadata(input: {
  kind: OgPortalKind;
  origin: string;
  portalPath: string;
  locale: ServerLocale;
}): OgPortalMetadata {
  const t = getServerT(input.locale, 'og');
  const isSign = input.kind === 'sign';
  return {
    kind: input.kind,
    available: false,
    title: t(isSign ? 'unavailable.titleSign' : 'unavailable.titleShare'),
    description: t(isSign ? 'unavailable.descriptionSign' : 'unavailable.descriptionShare'),
    imageUrl: cardImageUrl(input.origin, input.kind),
    canonicalUrl: toAbsolutePublicUrl(input.origin, input.portalPath),
    portalPath: input.portalPath,
    ctaLabel: t('unavailable.cta'),
    statusLabel: t('unavailable.status'),
    locale: input.locale,
  };
}

export async function getShareOgMetadata(
  token: string,
  origin: string,
  requestedLocale?: string | null,
): Promise<OgPortalMetadata> {
  const locale = normalizeServerLocale(requestedLocale);
  const t = getServerT(locale, 'og');
  const portalPath = buildExternalShareInvitePath(token);
  const access = await resolveExternalShareAccess(token);

  if (!access.grant) {
    return unavailableMetadata({ kind: 'share', origin, portalPath, locale });
  }

  try {
    // O payload ainda é buscado porque é ele que prova que o convite existe e está de pé — mas
    // nada do que ele carrega sobre o documento entra no cartão.
    const payload = await getExternalSharePortalPayload(token);
    const pending = payload.status === 'pending';

    return {
      kind: 'share',
      available: true,
      title: t('title.share'),
      description: t('description.share'),
      statusLabel: t(pending ? 'status.shareWaiting' : 'status.shareActive'),
      imageUrl: cardImageUrl(origin, 'share'),
      canonicalUrl: toAbsolutePublicUrl(origin, portalPath),
      portalPath,
      ctaLabel: t(pending ? 'cta.shareAccept' : 'cta.shareOpen'),
      locale,
    };
  } catch {
    return unavailableMetadata({ kind: 'share', origin, portalPath, locale });
  }
}

export async function getSignOgMetadata(
  token: string,
  origin: string,
  requestedLocale?: string | null,
): Promise<OgPortalMetadata> {
  const locale = normalizeServerLocale(requestedLocale);
  const t = getServerT(locale, 'og');
  const portalPath = buildSignaturePortalPath(token);
  const request = await findSignatureRequestByToken(token);

  if (!request || !isSignatureRequestOpen(request)) {
    return unavailableMetadata({ kind: 'sign', origin, portalPath, locale });
  }

  try {
    // Buscado para confirmar que a solicitação está aberta e o token vale. O conteúdo do
    // documento não atravessa daqui para o cartão.
    await getSignaturePortalPayload(token);

    return {
      kind: 'sign',
      available: true,
      title: t('title.sign'),
      description: t('description.sign'),
      statusLabel: t('status.signPending'),
      imageUrl: cardImageUrl(origin, 'sign'),
      canonicalUrl: toAbsolutePublicUrl(origin, portalPath),
      portalPath,
      ctaLabel: t('cta.sign'),
      locale,
    };
  } catch {
    return unavailableMetadata({ kind: 'sign', origin, portalPath, locale });
  }
}
