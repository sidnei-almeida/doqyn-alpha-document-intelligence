/**
 * Peças de papelaria comuns a documentos brasileiros de escritório.
 *
 * A dificuldade de um documento real quase nunca está no vocabulário: está no
 * arranjo. Um DANFE é difícil porque enfia quatro datas e dois CNPJs em caixas
 * vizinhas; um contrato é difícil porque a razão social da contratada aparece
 * uma vez, na qualificação, e depois só como "CONTRATADA". Estas peças existem
 * para reproduzir esse arranjo, e não só o texto.
 */

export const BASE_CSS = `
  @page { size: A4; margin: 18mm 16mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Liberation Serif', 'Noto Serif', serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #16181a;
    margin: 0;
  }
  .sans { font-family: 'Liberation Sans', 'DejaVu Sans', sans-serif; }
  .mono { font-family: 'Liberation Mono', 'DejaVu Sans Mono', monospace; }

  .letterhead {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 14mm; padding-bottom: 3mm; border-bottom: 1.6pt solid #1a1c1f; margin-bottom: 6mm;
  }
  .letterhead__mark {
    font-family: 'Liberation Sans', sans-serif; font-weight: 700; font-size: 15pt;
    letter-spacing: 0.14em; text-transform: uppercase;
  }
  .letterhead__legal { font-size: 7.6pt; line-height: 1.35; color: #3c4045; margin-top: 1.5mm; }
  .letterhead__meta { font-size: 7.8pt; text-align: right; color: #3c4045; line-height: 1.5; }

  h1.doc-title {
    font-size: 12.5pt; text-transform: uppercase; letter-spacing: 0.06em;
    text-align: center; margin: 6mm 0 1mm; font-weight: 700;
  }
  .doc-subtitle { text-align: center; font-size: 9pt; color: #3c4045; margin-bottom: 6mm; }

  h2.clause {
    font-size: 10pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.03em; margin: 5mm 0 1.5mm;
  }
  p { margin: 0 0 2.6mm; text-align: justify; }
  .indent { text-indent: 8mm; }

  table { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
  table.grid th, table.grid td { border: 0.5pt solid #2a2d31; padding: 1.2mm 1.8mm; vertical-align: top; }
  table.grid th {
    background: #eceded; font-family: 'Liberation Sans', sans-serif;
    font-size: 6.8pt; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; font-weight: 700;
  }
  table.plain td { padding: 1mm 0; vertical-align: top; }
  .num { text-align: right; font-family: 'Liberation Mono', monospace; }

  .boxrow { display: flex; border: 0.5pt solid #2a2d31; border-bottom: none; }
  .boxrow:last-of-type { border-bottom: 0.5pt solid #2a2d31; }
  .box { flex: 1; border-right: 0.5pt solid #2a2d31; padding: 1.1mm 1.8mm; min-height: 9mm; }
  .box:last-child { border-right: none; }
  .box__label {
    font-family: 'Liberation Sans', sans-serif; font-size: 5.9pt; text-transform: uppercase;
    letter-spacing: 0.06em; color: #4a4f55; display: block; margin-bottom: 0.6mm;
  }
  .box__value { font-size: 9pt; }

  .signatures { display: flex; gap: 12mm; margin-top: 14mm; page-break-inside: avoid; }
  .signature { flex: 1; text-align: center; }
  .signature__rule { border-top: 0.7pt solid #16181a; margin-bottom: 1.2mm; }
  .signature__name { font-size: 9pt; font-weight: 700; }
  .signature__role { font-size: 7.6pt; color: #3c4045; }

  .witnesses { margin-top: 10mm; font-size: 8.4pt; }
  .witnesses__title {
    font-family: 'Liberation Sans', sans-serif; font-size: 7pt; text-transform: uppercase;
    letter-spacing: 0.08em; color: #4a4f55; margin-bottom: 3mm;
  }

  .stamp {
    position: absolute; border: 2.2pt solid #7a1f22; color: #7a1f22;
    font-family: 'Liberation Sans', sans-serif; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; padding: 2mm 5mm; opacity: 0.62; border-radius: 1mm;
  }
  .stamp--paid { transform: rotate(-13deg); font-size: 16pt; }
  .stamp--copy { transform: rotate(-6deg); font-size: 11pt; border-color: #22406b; color: #22406b; }

  .watermark {
    position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-32deg);
    font-family: 'Liberation Sans', sans-serif; font-size: 58pt; font-weight: 700;
    color: rgba(20, 22, 26, 0.06); letter-spacing: 0.16em; z-index: -1;
  }

  .footnote {
    margin-top: 9mm; padding-top: 2mm; border-top: 0.4pt solid #b9bdc2;
    font-family: 'Liberation Sans', sans-serif; font-size: 6.4pt; color: #6b7076;
  }
  .digital-signature {
    margin-top: 8mm; border: 0.5pt dashed #4a4f55; padding: 2mm 3mm;
    font-family: 'Liberation Mono', monospace; font-size: 6.6pt; color: #3c4045; line-height: 1.5;
  }
  .handwritten {
    font-family: 'Z003', 'URW Chancery L', 'Liberation Serif', cursive;
    font-style: italic; font-size: 13pt; color: #1b2a55;
  }
  .page-break { page-break-after: always; }
`;

/**
 * A nota de rodapé que impede o arquivo de ser confundido com documento real.
 *
 * Fica pequena, no rodapé, e é idêntica em todos: um rótulo igual em toda a
 * coleção não distingue uma classe da outra, então não vira atalho para o
 * classificador acertar sem ler o documento.
 */
export const DISCLAIMER =
  'Documento sintético gerado para teste de extração automatizada. Pessoas, empresas e ' +
  'identificadores são fictícios e não correspondem a registros reais.';

export function page(title, bodyHtml, extraCss = '') {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<style>${BASE_CSS}${extraCss}</style></head>
<body>${bodyHtml}
<div class="footnote">${DISCLAIMER}</div>
</body></html>`;
}

export function letterhead({ name, legal, meta }) {
  return `<header class="letterhead">
    <div>
      <div class="letterhead__mark">${name}</div>
      <div class="letterhead__legal">${legal}</div>
    </div>
    <div class="letterhead__meta">${meta}</div>
  </header>`;
}

export function boxes(rows) {
  return rows
    .map(
      (row) =>
        `<div class="boxrow">${row
          .map(
            (cell) =>
              `<div class="box"${cell.flex ? ` style="flex:${cell.flex}"` : ''}>
                 <span class="box__label">${cell.label}</span>
                 <span class="box__value ${cell.mono ? 'mono' : ''}">${cell.value ?? '&nbsp;'}</span>
               </div>`,
          )
          .join('')}</div>`,
    )
    .join('');
}

export function gridTable(headers, rows, { align = [] } = {}) {
  return `<table class="grid">
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell, i) => `<td class="${align[i] === 'num' ? 'num' : ''}">${cell}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

export function signatures(people) {
  return `<div class="signatures">${people
    .map(
      (person) => `<div class="signature">
        <div class="signature__rule"></div>
        <div class="signature__name">${person.name}</div>
        <div class="signature__role">${person.role}</div>
        ${person.extra ? `<div class="signature__role">${person.extra}</div>` : ''}
      </div>`,
    )
    .join('')}</div>`;
}

export function witnesses(people) {
  return `<div class="witnesses">
    <div class="witnesses__title">Testemunhas</div>
    <div class="signatures" style="margin-top:6mm">${people
      .map(
        (person) => `<div class="signature">
          <div class="signature__rule"></div>
          <div class="signature__name">${person.name}</div>
          <div class="signature__role">${person.role}</div>
        </div>`,
      )
      .join('')}</div>
  </div>`;
}

export function digitalSignature(lines) {
  return `<div class="digital-signature">${lines.join('<br>')}</div>`;
}
