import type { MongoNotification } from '../../db/types.js';

/**
 * O aviso por e-mail, na mesma voz da tela.
 *
 * **Tabela e estilo embutido, não classe.** Cliente de e-mail não é navegador: Gmail remove `<style>`
 * do topo, Outlook renderiza com motor do Word, e flexbox não existe em metade deles. O que
 * sobrevive há vinte anos é tabela com largura fixa e `style=` em cada elemento — feio de escrever,
 * e a única coisa que chega igual dos dois lados.
 *
 * O corpo é curto de propósito: o e-mail avisa e leva de volta ao app, não repete o app. Quem
 * precisa do detalhe clica; quem só queria saber que aconteceu já soube pelo assunto.
 */
const GRAFITE = '#14181B';
const TEXTO = '#2C3338';
const MUDO = '#6B767D';
const LINHA = '#E4E9EC';
const LATAO = '#7C6220';

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type NotificationEmail = { subject: string; html: string; text: string };

export function buildNotificationEmail(
  notification: MongoNotification,
  appBaseUrl: string,
): NotificationEmail {
  const titulo = notification.title.trim();
  const corpo = notification.body?.trim();
  const documento = notification.documentName?.trim();

  // O destino é o documento quando existe; a caixa de avisos quando o fato não tem documento.
  const destino = notification.documentId
    ? `${appBaseUrl}/biblioteca?documento=${encodeURIComponent(notification.documentId)}`
    : `${appBaseUrl}/notificacoes`;

  const linhasTexto = [titulo, corpo, documento ? `Documento: ${documento}` : null, '', destino]
    .filter((linha): linha is string => linha !== null && linha !== undefined)
    .join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px 0;background:#F4F6F7;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;border-collapse:collapse;background:#FFFFFF;border:1px solid ${LINHA};border-radius:4px;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${MUDO};">DOQYN</span>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 0 32px;">
                <p style="margin:0;font-size:17px;line-height:1.4;color:${GRAFITE};">${escaparHtml(titulo)}</p>
                ${
                  corpo
                    ? `<p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:${TEXTO};">${escaparHtml(corpo)}</p>`
                    : ''
                }
                ${
                  documento
                    ? `<p style="margin:14px 0 0 0;font-size:12px;line-height:1.5;color:${MUDO};">Documento: ${escaparHtml(documento)}</p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;">
                <a href="${escaparHtml(destino)}" style="display:inline-block;padding:9px 18px;border:1px solid ${LATAO};border-radius:4px;color:${LATAO};font-size:13px;text-decoration:none;">Abrir no DOQYN</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 26px 32px;border-top:1px solid ${LINHA};">
                <p style="margin:16px 0 0 0;font-size:11px;line-height:1.6;color:${MUDO};">
                  Você recebe este aviso porque acompanha este documento no DOQYN.
                  Para deixar de recebê-lo por e-mail, ajuste as preferências de notificação no app.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    // O assunto carrega o fato inteiro: muita gente decide se abre sem passar da caixa de entrada.
    subject: documento ? `${titulo} — ${documento}` : titulo,
    html,
    text: linhasTexto,
  };
}
