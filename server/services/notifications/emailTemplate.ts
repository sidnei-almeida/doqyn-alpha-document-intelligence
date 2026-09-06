import type { MongoNotification } from '../../db/types.js';
import type { NotificationType } from '../../db/notificationTypes.js';
import {
  EMAIL_COLORS,
  EMAIL_FONTS,
  emailButton,
  emailFine,
  emailRow,
  emailRows,
  emailText,
  escapeHtml,
  plural,
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
 */

/**
 * O rótulo de registro do topo, por tipo de fato.
 *
 * É ele que faz a caixa de entrada distinguir um aviso de vencimento de um pedido de assinatura
 * antes de a pessoa ler o título.
 */
const EYEBROW: Record<NotificationType, string> = {
  document_expiring: 'Vencimento',
  document_created: 'Documento novo',
  document_updated: 'Documento atualizado',
  signature_required: 'Assinatura',
  document_shared: 'Compartilhamento',
  access_approved: 'Acesso liberado',
  access_rejected: 'Acesso recusado',
  approval_requested: 'Aprovação pendente',
  approval_decided: 'Aprovação decidida',
  document_requested: 'Documento solicitado',
  document_request_fulfilled: 'Solicitação atendida',
  inbound_share_received: 'Recebido de fora',
  inbound_share_accepted: 'Recebimento aceito',
  inbound_share_declined: 'Recebimento recusado',
  member_joined: 'Entrou na empresa',
};

/** O verbo do botão acompanha o fato: "revisar" e "abrir" pedem coisas diferentes. */
const ACTION_LABEL: Partial<Record<NotificationType, string>> = {
  signature_required: 'Abrir para assinar',
  member_joined: 'Ver em Usuários',
  approval_requested: 'Revisar pedido',
  document_requested: 'Ver o que foi pedido',
  document_expiring: 'Abrir documento',
};

/**
 * O prazo em palavras, e a cor que ele merece.
 *
 * Vermelho só quando já venceu — âmbar na semana final. O resto fica em cinza: pintar tudo de
 * urgente é o mesmo que não pintar nada.
 */
function expiryLine(daysRemaining: number): { text: string; color: string } {
  if (daysRemaining < 0) {
    return {
      text: `Venceu há ${plural(Math.abs(daysRemaining), 'dia', 'dias')}`,
      color: '#b3261e',
    };
  }
  if (daysRemaining === 0) return { text: 'Vence hoje', color: '#b3261e' };
  if (daysRemaining <= 7) {
    return { text: `Vence em ${plural(daysRemaining, 'dia', 'dias')}`, color: '#8a5a00' };
  }
  return { text: `Vence em ${plural(daysRemaining, 'dia', 'dias')}`, color: EMAIL_COLORS.muted };
}

export type NotificationEmail = { subject: string; html: string; text: string };

export function buildNotificationEmail(
  notification: MongoNotification,
  appBaseUrl: string,
): NotificationEmail {
  const title = notification.title.trim();
  const body = notification.body?.trim();
  const documentName = notification.documentName?.trim();
  const categoryName = notification.categoryName?.trim();
  const actorName = notification.actorName?.trim();

  // O destino é o documento quando existe; a caixa de avisos quando o fato não tem documento.
  const target = notification.documentId
    ? `${appBaseUrl}/biblioteca?documento=${encodeURIComponent(notification.documentId)}`
    : `${appBaseUrl}/notificacoes`;

  const expiry = notification.expiry ? expiryLine(notification.expiry.daysRemaining) : null;

  const rows = [
    documentName ? emailRow('Documento', documentName) : '',
    categoryName ? emailRow('Categoria', categoryName) : '',
    actorName ? emailRow('Por', actorName) : '',
  ].filter((row) => row.length > 0);

  const textLines = [
    title,
    body,
    documentName ? `Documento: ${documentName}` : null,
    categoryName ? `Categoria: ${categoryName}` : null,
    actorName ? `Por: ${actorName}` : null,
    expiry ? expiry.text : null,
    '',
    target,
  ].filter((line): line is string => Boolean(line) || line === '');

  const html = renderEmailLayout({
    eyebrow: EYEBROW[notification.type] ?? 'Aviso',
    title,
    blocks: [
      body ? emailText(escapeHtml(body)) : '',
      expiry
        ? `
                <p style="margin:0;font-family:${EMAIL_FONTS.mono};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${expiry.color};">${escapeHtml(expiry.text)}</p>`
        : '',
      emailRows(rows),
      emailButton(ACTION_LABEL[notification.type] ?? 'Abrir no DOQYN', target),
      emailFine(
        'Prefere não receber avisos por e-mail? Ajuste as preferências de notificação no app.',
      ),
    ],
    footNote:
      'Você recebeu este e-mail porque acompanha este documento no DOQYN, ou porque o aviso é dirigido à sua conta.',
  });

  return {
    // O assunto carrega o fato inteiro: muita gente decide se abre sem passar da caixa de entrada.
    subject: documentName ? `${title} — ${documentName}` : title,
    html,
    text: textLines.join('\n'),
  };
}
