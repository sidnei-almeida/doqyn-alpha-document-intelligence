import { getServerT, normalizeServerLocale } from '../../i18n/index.js';
import {
  emailButton,
  emailRow,
  emailRows,
  emailText,
  escapeHtml,
  renderEmailLayout,
} from './emailLayout.js';

/**
 * E-mail para quem recebeu um link, mas não tem conta no DOQYN.
 *
 * Deliberadamente sem `documentName`/`documentTitle`/`fileName` em qualquer assinatura aqui: o
 * título do documento pode ser confidencial, e este e-mail vai para um endereço que alguém
 * digitou num formulário. O documento continua atrás do link — só quem abre o link o vê.
 */

export type ExternalGuestEmail = { subject: string; html: string; text: string };

function formatCalendarDate(lang: string, date: Date): string {
  return new Intl.DateTimeFormat(lang, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function buildExternalShareInviteEmail(input: {
  recipientLocale?: string | null;
  inviteUrl: string;
  senderName: string;
  tenantName: string;
  expiresAt?: Date | null;
  canDownload: boolean;
  message?: string | null;
}): ExternalGuestEmail {
  const lang = normalizeServerLocale(input.recipientLocale);
  const t = getServerT(lang, 'email');

  const title = t('externalGuest.share.title', { senderName: input.senderName });
  const permissionLabel = input.canDownload
    ? t('externalGuest.permission.viewAndDownload')
    : t('externalGuest.permission.viewOnly');
  const expiryText = input.expiresAt ? formatCalendarDate(lang, input.expiresAt) : null;

  const rows = [
    emailRow(t('externalGuest.row.sharedBy'), `${input.senderName} — ${input.tenantName}`),
    expiryText ? emailRow(t('externalGuest.row.expiresAt'), expiryText) : null,
    emailRow(t('externalGuest.row.permission'), permissionLabel),
  ].filter((row): row is string => Boolean(row));

  const html = renderEmailLayout({
    lang,
    eyebrow: t('externalGuest.share.eyebrow'),
    title,
    blocks: [
      input.message ? emailText(escapeHtml(input.message)) : '',
      emailRows(rows),
      emailButton(t('externalGuest.share.action'), input.inviteUrl),
    ],
    footNote: t('externalGuest.footNote'),
  });

  const textLines = [
    title,
    input.message ?? '',
    `${t('externalGuest.row.sharedBy')}: ${input.senderName} — ${input.tenantName}`,
    expiryText ? `${t('externalGuest.row.expiresAt')}: ${expiryText}` : '',
    `${t('externalGuest.row.permission')}: ${permissionLabel}`,
    '',
    input.inviteUrl,
  ].filter((line) => Boolean(line) || line === '');

  return { subject: title, html, text: textLines.join('\n') };
}

export function buildExternalSignatureInviteEmail(input: {
  recipientLocale?: string | null;
  portalUrl: string;
  senderName: string;
  tenantName: string;
  expiresAt?: Date | null;
  message?: string | null;
}): ExternalGuestEmail {
  const lang = normalizeServerLocale(input.recipientLocale);
  const t = getServerT(lang, 'email');

  const title = t('externalGuest.signature.title', { senderName: input.senderName });
  const expiryText = input.expiresAt ? formatCalendarDate(lang, input.expiresAt) : null;

  const rows = [
    emailRow(t('externalGuest.row.requestedBy'), `${input.senderName} — ${input.tenantName}`),
    expiryText ? emailRow(t('externalGuest.row.expiresAt'), expiryText) : null,
  ].filter((row): row is string => Boolean(row));

  const html = renderEmailLayout({
    lang,
    eyebrow: t('externalGuest.signature.eyebrow'),
    title,
    blocks: [
      input.message ? emailText(escapeHtml(input.message)) : '',
      emailRows(rows),
      emailButton(t('externalGuest.signature.action'), input.portalUrl),
    ],
    footNote: t('externalGuest.footNote'),
  });

  const textLines = [
    title,
    input.message ?? '',
    `${t('externalGuest.row.requestedBy')}: ${input.senderName} — ${input.tenantName}`,
    expiryText ? `${t('externalGuest.row.expiresAt')}: ${expiryText}` : '',
    '',
    input.portalUrl,
  ].filter((line) => Boolean(line) || line === '');

  return { subject: title, html, text: textLines.join('\n') };
}
