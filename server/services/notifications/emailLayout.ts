/**
 * A casca de todo e-mail do DOQYN.
 *
 * **Cópia proposital de `src/modules/email/emailLayout.ts` do `doqyn-auth-service`.** Os dois
 * repositórios são processos separados e não compartilham código; a alternativa seria um pacote
 * publicado só para isto. Mudou aqui, mude lá — e o contrário.
 *
 * **Tabela e estilo embutido, não classe.** Cliente de e-mail não é navegador: o Gmail remove
 * `<style>` do topo, o Outlook renderiza com o motor do Word, e flexbox não existe em metade
 * deles. O que sobrevive há vinte anos é tabela de largura fixa com `style=` em cada elemento —
 * chato de escrever, e a única coisa que chega igual dos dois lados.
 *
 * A linguagem é a mesma do app, com as concessões que o meio exige:
 *
 * - **Linha, não caixa.** Uma régua de acento acima do título, e fios separando os blocos. A
 *   moldura arredondada com sombra que todo e-mail transacional usa é justamente o que faz eles
 *   parecerem todos o mesmo produto.
 * - **Canto de 4px** no botão, como no app. Pílula lê como produto de consumo.
 * - **Serifada no título.** Newsreader não existe em cliente de e-mail; Georgia é a serifada que
 *   está em toda parte e sustenta o mesmo peso.
 * - **Monoespaçado no rótulo de registro** — o eyebrow e o código, que se leem caractere a
 *   caractere.
 * - **Verdigris é ação; latão só atesta.** O botão é verdigris. Latão aparece só quando o e-mail
 *   carrega uma prova — assinatura, verificação — e mesmo aí como contorno, nunca preenchido.
 */

/** Paleta clara, copiada de `src/styles/tokens.css` do alpha. */
export const EMAIL_COLORS = {
  page: '#f5f7f8',
  surface: '#ffffff',
  text: '#11171b',
  body: '#4a575f',
  muted: '#5f6c74',
  line: '#e4e8eb',
  lineStrong: '#d3d9de',
  accent: '#0e6e6a',
  onAccent: '#ffffff',
  seal: '#7c6220',
  sealSoft: '#f4eedf',
} as const;

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

export const EMAIL_FONTS = { sans: SANS, serif: SERIF, mono: MONO } as const;

/**
 * Plural, e não `hora(s)`.
 *
 * O parêntese é a marca de e-mail gerado por sistema — custa uma função escrever certo, e o
 * e-mail transacional é justamente onde a empresa parece cuidadosa ou parece automática.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A marca no cabeçalho — símbolo em SVG e wordmark ao lado.
 *
 * SVG embutido em vez de imagem hospedada: cliente de e-mail bloqueia imagem remota por padrão,
 * e a marca não pode depender de alguém clicar em "exibir imagens". O Outlook antigo ignora SVG,
 * e é por isso que o wordmark é texto — ele sozinho já identifica o remetente.
 */
function brandHeader(): string {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:9px;line-height:0;">
                    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" style="display:block;">
                      <circle cx="22" cy="22" r="15" stroke="${EMAIL_COLORS.accent}" stroke-width="3" />
                      <circle cx="22" cy="22" r="10" stroke="${EMAIL_COLORS.accent}" stroke-width="1.6" opacity="0.5" />
                      <path d="M25.5 25.5 L38 38" stroke="${EMAIL_COLORS.accent}" stroke-width="4.6" stroke-linecap="round" />
                    </svg>
                  </td>
                  <td valign="middle" style="font-family:${SANS};font-size:15px;font-weight:600;letter-spacing:0.18em;color:${EMAIL_COLORS.text};">
                    DOQYN
                  </td>
                </tr>
              </table>`;
}

/** Botão de ação. Canto de 4px, verdigris preenchido — uma por e-mail. */
export function emailButton(label: string, href: string): string {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:4px;background:${EMAIL_COLORS.accent};">
                    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:14px;font-weight:600;line-height:1;color:${EMAIL_COLORS.onAccent};text-decoration:none;border-radius:4px;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table>`;
}

/**
 * O código de 6 dígitos, espaçado.
 *
 * Fundo claro e fio embaixo em vez de caixa: é o mesmo campo em régua do app. O espaço no meio
 * (`123 456`) é o que torna seis dígitos legíveis de relance, e o `letter-spacing` separa os
 * caracteres para quem copia à mão.
 */
export function emailCode(code: string): string {
  const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:6px 0 14px 0;border-bottom:2px solid ${EMAIL_COLORS.accent};">
                    <span style="font-family:${MONO};font-size:31px;font-weight:600;letter-spacing:0.16em;color:${EMAIL_COLORS.text};">${escapeHtml(formatted)}</span>
                  </td>
                </tr>
              </table>`;
}

/** Selo de atestação — o único lugar onde o latão aparece, e sempre em contorno. */
export function emailSeal(label: string): string {
  return `<span style="display:inline-block;padding:5px 11px;border:1px solid ${EMAIL_COLORS.seal};border-radius:999px;font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_COLORS.seal};">${escapeHtml(label)}</span>`;
}

/** Par rótulo/valor, em fio — a mesma linha de registro das telas. */
export function emailRow(label: string, value: string): string {
  return `
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid ${EMAIL_COLORS.line};font-family:${SANS};font-size:13px;line-height:1.5;color:${EMAIL_COLORS.muted};">
                    <span style="font-family:${MONO};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${escapeHtml(label)}</span><br />
                    <span style="color:${EMAIL_COLORS.text};font-size:14px;">${escapeHtml(value)}</span>
                  </td>
                </tr>`;
}

/** Envolve linhas de `emailRow` na tabela que as separa. */
export function emailRows(rows: string[]): string {
  if (rows.length === 0) return '';
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid ${EMAIL_COLORS.line};">
                ${rows.join('')}
              </table>`;
}

export type EmailLayoutInput = {
  /** Rótulo de registro acima do título — curto, em caixa alta. */
  eyebrow: string;
  title: string;
  /** Blocos do corpo, já em HTML. Cada um vira uma faixa com o mesmo respiro. */
  blocks: string[];
  /** Última linha, em cinza miúdo: por que a pessoa recebeu isto, e o que ignorar significa. */
  footNote: string;
};

export function renderEmailLayout(input: EmailLayoutInput): string {
  const body = input.blocks
    .filter((block) => block.trim().length > 0)
    .map(
      (block) => `
            <tr>
              <td style="padding:0 36px 20px 36px;">${block}
              </td>
            </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
  </head>
  <body style="margin:0;padding:32px 12px;background:${EMAIL_COLORS.page};font-family:${SANS};-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;border-collapse:collapse;background:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.line};border-radius:4px;">
            <tr>
              <td style="padding:30px 36px 0 36px;">${brandHeader()}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 0 36px;">
                <!-- A régua de acento marca o começo do assunto, como o fio que marca o item
                     ativo nas listas do app. -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="width:26px;height:2px;background:${EMAIL_COLORS.accent};line-height:0;font-size:0;">&nbsp;</td></tr>
                </table>
                <p style="margin:14px 0 0 0;font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">${escapeHtml(input.eyebrow)}</p>
                <h1 style="margin:9px 0 0 0;font-family:${SERIF};font-size:25px;font-weight:400;line-height:1.25;color:${EMAIL_COLORS.text};">${escapeHtml(input.title)}</h1>
              </td>
            </tr>
            <tr><td style="height:22px;line-height:0;font-size:0;">&nbsp;</td></tr>${body}
            <tr>
              <td style="padding:4px 36px 30px 36px;border-top:1px solid ${EMAIL_COLORS.line};">
                <p style="margin:18px 0 0 0;font-family:${SANS};font-size:11px;line-height:1.65;color:${EMAIL_COLORS.muted};">${escapeHtml(input.footNote)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_COLORS.muted};">DOQYN · Document Intelligence</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Parágrafo do corpo, no tamanho e na cor de leitura. */
export function emailText(html: string): string {
  return `
                <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${EMAIL_COLORS.body};">${html}</p>`;
}

/** Trecho miúdo — o link alternativo, o aviso de prazo. */
export function emailFine(html: string): string {
  return `
                <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${EMAIL_COLORS.muted};">${html}</p>`;
}

/** Destaque em negrito, na cor do texto principal. */
export function strong(value: string): string {
  return `<strong style="color:${EMAIL_COLORS.text};font-weight:600;">${escapeHtml(value)}</strong>`;
}
