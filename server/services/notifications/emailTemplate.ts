import type { MongoNotification } from '../../db/types.js';
import { getServerT, normalizeServerLocale, renderNotificationText } from '../../i18n/index.js';
import {
  EMAIL_COLORS,
  EMAIL_FONTS,
  emailButton,
  emailFine,
  emailRow,
  emailRows,
  emailText,
  escapeHtml,
  renderEmailLayout,
} from './emailLayout.js';

/**
 * O aviso por e-mail, na mesma voz da tela.
 *
 * O corpo é curto de propósito: o e-mail avisa e leva de volta ao app, não repete o app. Quem
 * precisa do detalhe clica; quem só queria saber que aconteceu já soube pelo assunto.
 *
 * O que este template acrescenta ao texto que o serviço já compõe é o **contexto em linha de
 * registro** — documento, quem causou, prazo. Sem isso o e-mail dizia "documento vencendo" e
 * obrigava a abrir o app só para descobrir qual.
 *
 * O idioma é o de **quem recebe**, decidido no envio: um evento que avisa cinco pessoas pode sair
 * em três idiomas. Os rótulos vêm do catálogo `email`; título e corpo são remontados de `params`,
 * e a notificação gravada antes deles manda o texto que ficou salvo.
 */

/** O verbo do botão acompanha o fato: "revisar" e "abrir" pedem coisas diferentes. */
const TYPES_WITH_ACTION = new Set<MongoNotification['type']>([
  'signature_required',
  'member_joined',
  'approval_requested',
  'document_requested',
  'document_expiring',
]);

type Translate = ReturnType<typeof getServerT>;

/**
 * A data de validade, e a cor que ela merece.
 *
 * O título já diz quantos dias faltam; repetir o prazo aqui dobrava a frase. A linha dá o que o
 * título não tem — o dia — e guarda a cor: vermelho quando venceu ou vence hoje, âmbar na semana
 * final. O resto fica em cinza: pintar tudo de urgente é o mesmo que não pintar nada.
 */
function expiryLine(
  t: Translate,
  lang: string,
  expiry: NonNullable<MongoNotification['expiry']>,
): { text: string; color: string } | null {
  const validity = new Date(expiry.validityDate);
  if (Number.isNaN(validity.getTime())) return null;
  // Data de calendário: em UTC, senão o Brasil lê o dia anterior.
  const date = new Intl.DateTimeFormat(lang, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(validity);
  const { daysRemaining } = expiry;
  if (daysRemaining < 0) {
    return { text: t('notification.expiry.expiredOn', { date }), color: '#b3261e' };
  }
  return {
    text: t('notification.expiry.validUntil', { date }),
    color: daysRemaining === 0 ? '#b3261e' : daysRemaining <= 7 ? '#8a5a00' : EMAIL_COLORS.muted,
  };
}

export type NotificationEmail = { subject: string; html: string; text: string };

export function buildNotificationEmail(
  notification: MongoNotification,
  appBaseUrl: string,
  locale?: string | null,
): NotificationEmail {
  const lang = normalizeServerLocale(locale);
  const t = getServerT(lang, 'email');

  const rendered = notification.params
    ? renderNotificationText(lang, notification.type, notification.params)
    : undefined;
  const title = (rendered?.title ?? notification.title).trim();
  const body = (rendered ? rendered.body : notification.body)?.trim();
  const documentName = notification.documentName?.trim();
  const categoryName = notification.categoryName?.trim();
  const actorName = notification.actorName?.trim();

  // O destino é o documento quando existe; a caixa de avisos quando o fato não tem documento.
  const target = notification.documentId
    ? // `preview` é o parâmetro que a Biblioteca lê para abrir o documento. O link levava
      // `documento`, que ninguém lia: o e-mail abria a lista, e não o documento do aviso.
      `${appBaseUrl}/library?preview=${encodeURIComponent(notification.documentId)}`
    : `${appBaseUrl}/notifications`;

  const expiry = notification.expiry ? expiryLine(t, lang, notification.expiry) : null;

  const details = [
    documentName ? { label: t('notification.row.document'), value: documentName } : null,
    categoryName ? { label: t('notification.row.category'), value: categoryName } : null,
    actorName ? { label: t('notification.row.actor'), value: actorName } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const textLines = [
    title,
    body,
    ...details.map((row) => `${row.label}: ${row.value}`),
    expiry ? expiry.text : null,
    '',
    target,
  ].filter((line): line is string => Boolean(line) || line === '');

  const html = renderEmailLayout({
    lang,
    eyebrow: t(`notification.eyebrow.${notification.type}`, {
      defaultValue: t('notification.eyebrowFallback'),
    }),
    title,
    blocks: [
      body ? emailText(escapeHtml(body)) : '',
      expiry
        ? `
                <p style="margin:0;font-family:${EMAIL_FONTS.mono};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${expiry.color};">${escapeHtml(expiry.text)}</p>`
        : '',
      emailRows(details.map((row) => emailRow(row.label, row.value))),
      emailButton(
        TYPES_WITH_ACTION.has(notification.type)
          ? t(`notification.action.${notification.type}`)
          : t('notification.actionFallback'),
        target,
      ),
      emailFine(escapeHtml(t('notification.preferencesHint'))),
    ],
    // "Acompanha este documento" num aviso sem documento dizia algo que não aconteceu.
    footNote: t(notification.documentId ? 'notification.footNote' : 'notification.footNoteAccount'),
  });

  return {
    // O assunto carrega o fato inteiro: muita gente decide se abre sem passar da caixa de entrada.
    // Quase todo título já nomeia o documento; acrescentar de novo só alongava o assunto.
    subject: documentName && !title.includes(documentName) ? `${title} — ${documentName}` : title,
    html,
    text: textLines.join('\n'),
  };
}
