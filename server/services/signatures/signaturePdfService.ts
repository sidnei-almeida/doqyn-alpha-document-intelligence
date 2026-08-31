import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { TrackingSecurityContext } from '../tracking/securityContext.js';
import {
  buildCompactStampLines,
  computeSignatureStampLayoutAtIndex,
  computeSignatureStampLayouts,
  getSignatureStampMetrics,
  SIGNATURE_STAMP_MARKER,
  type SignatureStampData,
} from './signatureStampLayout.js';
import {
  resolveSignatureStampTargetPage,
  SIGNATURE_CERTIFICATE_PAGE_MARKER,
  SIGNATURE_CERTIFICATE_PAGE_TITLE,
} from './signaturePdfPageUtils.js';

export { SIGNATURE_STAMP_MARKER };

/**
 * Paleta da marca dentro do PDF. Grafite escreve, latão atesta — latão nunca preenche
 * área, só fio e contorno, como no resto do sistema.
 */
const INK = rgb(0.078, 0.094, 0.106);
const INK_SOFT = rgb(0.42, 0.45, 0.47);
const RULE = rgb(0.82, 0.83, 0.84);
const BRASS = rgb(0.76, 0.627, 0.353);
const PAPER = rgb(1, 1, 1);

export const SIGNATURE_CONSENT_TEXT =
  'Declaro que li o documento apresentado e concordo em assiná-lo eletronicamente por meio da plataforma DOQYN. Estou ciente de que minha assinatura será vinculada a este documento com data, hora e evidências técnicas de auditoria.';

export type GenerateSignedPdfInput = {
  originalPdfBuffer: Buffer;
  documentName: string;
  documentId: string;
  versionId: string;
  signatureRequestId: string;
  signatureId: string;
  signerName: string;
  signerEmailMasked: string;
  signerPhoneMasked?: string;
  organizationName?: string;
  signedAt: Date;
  verificationCode: string;
  verificationUrl: string;
  /** Assinaturas já concluídas no documento — cada uma corresponde a 1 certificado no final. */
  completedSignatureCount?: number;
  securityContext?: TrackingSecurityContext;
  issuerOrganizationName?: string;
  /** Assinaturas anteriores na mesma versão — carimbos empilhados no rodapé. */
  previousStamps?: SignatureStampData[];
};

function formatSignedAt(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

/**
 * Rótulo em maiúsculas espaçadas. O pdf-lib desta versão não tem `characterSpacing`,
 * então o espaçamento é feito caractere a caractere — é o mesmo efeito do rótulo mono
 * do app, que é o que separa registro de texto corrido.
 */
function drawTracked(input: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  color: ReturnType<typeof rgb>;
  tracking: number;
}) {
  let cursor = input.x;
  for (const char of input.text) {
    input.page.drawText(char, {
      x: cursor,
      y: input.y,
      size: input.size,
      font: input.font,
      color: input.color,
    });
    cursor += input.font.widthOfTextAtSize(char, input.size) + input.tracking;
  }
  return cursor - input.x;
}

function drawRule(page: PDFPage, x: number, y: number, width: number) {
  page.drawRectangle({ x, y, width, height: 0.5, color: RULE });
}

/** A marca desenhada em vetor: o anel do Q, o traço que sai dele, e o nome. */
function drawBrandMark(page: PDFPage, x: number, y: number, boldFont: PDFFont) {
  page.drawCircle({ x: x + 7, y: y + 7, size: 7, borderColor: INK, borderWidth: 1.1 });
  page.drawLine({
    start: { x: x + 9.5, y: y + 4.5 },
    end: { x: x + 14, y: y },
    color: BRASS,
    thickness: 1.4,
  });
  drawTracked({
    page,
    text: 'DOQYN',
    x: x + 22,
    y: y + 2.5,
    size: 11,
    font: boldFont,
    color: INK,
    tracking: 2.2,
  });
}

/** Quebra o texto na largura disponível e devolve o y livre logo abaixo do bloco. */
function drawParagraph(input: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  size: number;
  lineHeight: number;
  color: ReturnType<typeof rgb>;
}): number {
  const words = input.text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  const pushBrokenWord = (word: string) => {
    let chunk = '';
    for (const char of word) {
      const candidate = chunk + char;
      if (input.font.widthOfTextAtSize(candidate, input.size) > input.maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }
    current = chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (input.font.widthOfTextAtSize(candidate, input.size) <= input.maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (input.font.widthOfTextAtSize(word, input.size) > input.maxWidth) {
      pushBrokenWord(word);
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);

  let y = input.y;
  for (const line of lines) {
    input.page.drawText(line, {
      x: input.x,
      y,
      size: input.size,
      font: input.font,
      color: input.color,
    });
    y -= input.lineHeight;
  }
  return y;
}

/** Coluna de registro: rótulo em maiúsculas espaçadas, valor logo abaixo. */
function drawRegisterColumn(input: {
  page: PDFPage;
  rows: Array<[string, string]>;
  x: number;
  y: number;
  width: number;
  labelFont: PDFFont;
  valueFont: PDFFont;
}): number {
  let y = input.y;
  for (const [label, value] of input.rows) {
    drawTracked({
      page: input.page,
      text: label,
      x: input.x,
      y,
      size: 6.5,
      font: input.labelFont,
      color: INK_SOFT,
      tracking: 1.1,
    });
    y -= 11;
    y = drawParagraph({
      page: input.page,
      text: value || '—',
      x: input.x,
      y,
      maxWidth: input.width,
      font: input.valueFont,
      size: 9.5,
      lineHeight: 12,
      color: INK,
    });
    y -= 14;
  }
  return y;
}

function drawCompactStamp(input: {
  page: PDFPage;
  layout: ReturnType<typeof computeSignatureStampLayouts>[number];
  stamp: SignatureStampData;
  font: PDFFont;
  boldFont: PDFFont;
  monoFont: PDFFont;
}) {
  const metrics = getSignatureStampMetrics();
  const [name, when, code] = buildCompactStampLines(input.stamp);
  const { x, y, width, height } = input.layout;

  // Papel do carimbo: quase opaco, para o carimbo ler sobre qualquer conteúdo.
  input.page.drawRectangle({
    x,
    y,
    width,
    height,
    color: PAPER,
    opacity: 0.92,
    borderColor: RULE,
    borderWidth: 0.4,
  });

  // Fio de latão à esquerda — a marca de atestação, do jeito que o kit manda.
  input.page.drawRectangle({
    x,
    y,
    width: metrics.ruleWidth,
    height,
    color: BRASS,
  });

  const textX = x + metrics.paddingX;
  let cursorY = y + height - metrics.paddingY - metrics.fontSize;

  input.page.drawText(name ?? '', {
    x: textX,
    y: cursorY,
    size: metrics.fontSize + 0.5,
    font: input.boldFont,
    color: INK,
  });
  cursorY -= metrics.lineHeight;

  input.page.drawText(when ?? '', {
    x: textX,
    y: cursorY,
    size: metrics.fontSize - 0.5,
    font: input.font,
    color: INK_SOFT,
  });
  cursorY -= metrics.lineHeight;

  input.page.drawText(code ?? '', {
    x: textX,
    y: cursorY,
    size: metrics.fontSize - 0.5,
    font: input.monoFont,
    color: INK_SOFT,
  });
}

function drawStampsOnPage(input: {
  page: PDFPage;
  pageWidth: number;
  currentStamp: SignatureStampData;
  completedSignatureCount: number;
  previousStamps?: SignatureStampData[];
  font: PDFFont;
  boldFont: PDFFont;
  monoFont: PDFFont;
}) {
  const completed = Math.max(0, input.completedSignatureCount);

  if (completed > 0) {
    const layout = computeSignatureStampLayoutAtIndex(input.pageWidth, completed);
    drawCompactStamp({
      page: input.page,
      layout,
      stamp: input.currentStamp,
      font: input.font,
      boldFont: input.boldFont,
      monoFont: input.monoFont,
    });
    return;
  }

  const stampsToDraw = [...(input.previousStamps ?? []), input.currentStamp];
  const layouts = computeSignatureStampLayouts(input.pageWidth, stampsToDraw.length);
  for (let index = 0; index < stampsToDraw.length; index += 1) {
    const layout = layouts[index];
    if (!layout) continue;
    drawCompactStamp({
      page: input.page,
      layout,
      stamp: stampsToDraw[index]!,
      font: input.font,
      boldFont: input.boldFont,
      monoFont: input.monoFont,
    });
  }
}

export async function generateSignedPdf(input: GenerateSignedPdfInput): Promise<{
  signedPdfBuffer: Buffer;
  originalDocumentHashSha256: string;
  signedPdfHashSha256: string;
  evidencePayload: Record<string, unknown>;
  evidenceHashSha256: string;
}> {
  const originalDocumentHashSha256 = createHash('sha256')
    .update(input.originalPdfBuffer)
    .digest('hex');

  const pdfDoc = await PDFDocument.load(input.originalPdfBuffer, { ignoreEncryption: true });
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  // Serifada para o título e mono para código e hash — a mesma divisão de vozes do app.
  const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const stampPage = resolveSignatureStampTargetPage(pdfDoc, input.completedSignatureCount ?? 0);
  const { width: pageWidth } = stampPage.getSize();

  const currentStamp: SignatureStampData = {
    signerName: input.signerName,
    signedAt: input.signedAt,
    verificationCode: input.verificationCode,
  };
  const completedSignatureCount = input.completedSignatureCount ?? 0;

  drawStampsOnPage({
    page: stampPage,
    pageWidth,
    currentStamp,
    completedSignatureCount,
    previousStamps: input.previousStamps,
    font: regularFont,
    boldFont,
    monoFont,
  });

  const locationParts = [
    input.securityContext?.city,
    input.securityContext?.region,
    input.securityContext?.country,
  ].filter(Boolean);

  const certPage = pdfDoc.addPage();
  const { width, height } = certPage.getSize();
  const MARGIN = 54;
  const contentWidth = width - MARGIN * 2;

  // Marcador invisível: é ele que identifica a folha como certificado em auditoria.
  certPage.drawText(SIGNATURE_CERTIFICATE_PAGE_MARKER, { x: 0, y: 0, size: 0.01, opacity: 0 });

  drawBrandMark(certPage, MARGIN, height - 58, boldFont);

  drawTracked({
    page: certPage,
    text: 'CERTIFICADO DE ASSINATURA ELETRÔNICA',
    x: MARGIN,
    y: height - 92,
    size: 7,
    font: boldFont,
    color: INK_SOFT,
    tracking: 1.6,
  });

  let y = height - 122;
  y = drawParagraph({
    page: certPage,
    text: input.documentName,
    x: MARGIN,
    y,
    maxWidth: contentWidth - 150,
    font: serifFont,
    size: 20,
    lineHeight: 24,
    color: INK,
  });

  y -= 6;
  certPage.drawText(`Assinado por ${input.signerName} · ${formatSignedAt(input.signedAt)} BRT`, {
    x: MARGIN,
    y,
    size: 9.5,
    font: regularFont,
    color: INK_SOFT,
  });

  // O fio do cabeçalho para antes do selo: linha atravessando o QR lê como erro de impressão.
  y -= 18;
  drawRule(certPage, MARGIN, y, contentWidth - 150);
  y -= 26;

  // Selo de verificação: QR e código, em contorno de latão, no alto à direita.
  const sealSize = 132;
  const sealX = width - MARGIN - sealSize;
  const sealY = height - 92 - sealSize;
  certPage.drawRectangle({
    x: sealX,
    y: sealY,
    width: sealSize,
    height: sealSize,
    borderColor: BRASS,
    borderWidth: 0.8,
  });
  const qrPng = await QRCode.toBuffer(input.verificationUrl, {
    width: 220,
    margin: 0,
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdfDoc.embedPng(qrPng);
  certPage.drawImage(qrImage, {
    x: sealX + 18,
    y: sealY + 32,
    width: sealSize - 36,
    height: sealSize - 36,
  });
  certPage.drawText(input.verificationCode, {
    x: sealX + 12,
    y: sealY + 14,
    size: 8,
    font: monoFont,
    color: BRASS,
  });

  const signerRows: Array<[string, string]> = [
    ['SIGNATÁRIO', input.signerName],
    ['E-MAIL', input.signerEmailMasked],
    ...(input.signerPhoneMasked
      ? ([['TELEFONE', input.signerPhoneMasked]] as Array<[string, string]>)
      : []),
    ...(input.organizationName
      ? ([['ORGANIZAÇÃO', input.organizationName]] as Array<[string, string]>)
      : []),
    ...(input.issuerOrganizationName
      ? ([['SOLICITADO POR', input.issuerOrganizationName]] as Array<[string, string]>)
      : []),
    ['DATA E HORA', `${formatSignedAt(input.signedAt)} (BRT)`],
  ];

  const evidenceRows: Array<[string, string]> = [
    ['IP', input.securityContext?.ipAddressMasked ?? '—'],
    ['LOCAL APROXIMADO', locationParts.length ? locationParts.join(', ') : '—'],
    [
      'NAVEGADOR',
      `${input.securityContext?.browser ?? '—'} ${input.securityContext?.browserVersion ?? ''}`.trim(),
    ],
    [
      'SISTEMA',
      `${input.securityContext?.os ?? '—'} ${input.securityContext?.osVersion ?? ''}`.trim(),
    ],
    ['DISPOSITIVO', input.securityContext?.deviceType ?? '—'],
    ['MÉTODO', 'Assinatura eletrônica DOQYN'],
  ];

  const columnWidth = (contentWidth - 28) / 2;
  const leftEnd = drawRegisterColumn({
    page: certPage,
    rows: signerRows,
    x: MARGIN,
    y,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: regularFont,
  });
  const rightEnd = drawRegisterColumn({
    page: certPage,
    rows: evidenceRows,
    x: MARGIN + columnWidth + 28,
    y,
    width: columnWidth,
    labelFont: boldFont,
    valueFont: regularFont,
  });

  y = Math.min(leftEnd, rightEnd) - 10;
  drawRule(certPage, MARGIN, y, contentWidth);
  y -= 24;

  drawTracked({
    page: certPage,
    text: 'IDENTIFICADORES E INTEGRIDADE',
    x: MARGIN,
    y,
    size: 7,
    font: boldFont,
    color: INK_SOFT,
    tracking: 1.4,
  });
  y -= 18;

  const technicalRows: Array<[string, string]> = [
    ['Documento', input.documentId],
    ['Versão', input.versionId],
    ['Solicitação', input.signatureRequestId],
    ['Assinatura', input.signatureId],
    ['SHA-256 do original', originalDocumentHashSha256],
  ];

  for (const [label, value] of technicalRows) {
    certPage.drawText(label, { x: MARGIN, y, size: 8, font: regularFont, color: INK_SOFT });
    y = drawParagraph({
      page: certPage,
      text: value,
      x: MARGIN + 118,
      y,
      maxWidth: contentWidth - 118,
      font: monoFont,
      size: 8,
      lineHeight: 11,
      color: INK,
    });
    y -= 5;
  }

  y -= 8;
  drawRule(certPage, MARGIN, y, contentWidth);
  y -= 20;

  drawTracked({
    page: certPage,
    text: 'DECLARAÇÃO DE ACEITE',
    x: MARGIN,
    y,
    size: 7,
    font: boldFont,
    color: INK_SOFT,
    tracking: 1.4,
  });
  y -= 16;
  y = drawParagraph({
    page: certPage,
    text: SIGNATURE_CONSENT_TEXT,
    x: MARGIN,
    y,
    maxWidth: contentWidth,
    font: regularFont,
    size: 8.5,
    lineHeight: 12,
    color: INK_SOFT,
  });

  const priorSignatures = completedSignatureCount + (input.previousStamps?.length ?? 0);
  if (priorSignatures > 0) {
    y -= 14;
    certPage.drawText(
      priorSignatures === 1
        ? 'Este documento já possuía 1 assinatura anterior.'
        : `Este documento já possuía ${priorSignatures} assinaturas anteriores.`,
      { x: MARGIN, y, size: 8.5, font: regularFont, color: INK_SOFT },
    );
  }

  drawRule(certPage, MARGIN, 74, contentWidth);
  certPage.drawText('Valide esta assinatura em', {
    x: MARGIN,
    y: 58,
    size: 8,
    font: regularFont,
    color: INK_SOFT,
  });
  drawParagraph({
    page: certPage,
    text: input.verificationUrl,
    x: MARGIN,
    y: 46,
    maxWidth: contentWidth - 120,
    font: monoFont,
    size: 8,
    lineHeight: 10,
    color: INK,
  });
  certPage.drawText(SIGNATURE_CERTIFICATE_PAGE_TITLE, {
    x: width - MARGIN - regularFont.widthOfTextAtSize(SIGNATURE_CERTIFICATE_PAGE_TITLE, 7.5),
    y: 46,
    size: 7.5,
    font: regularFont,
    color: INK_SOFT,
  });

  const signedBytes = await pdfDoc.save();
  const signedPdfBuffer = Buffer.from(signedBytes);
  const signedPdfHashSha256 = createHash('sha256').update(signedPdfBuffer).digest('hex');

  const evidencePayload: Record<string, unknown> = {
    signatureId: input.signatureId,
    signatureRequestId: input.signatureRequestId,
    documentId: input.documentId,
    versionId: input.versionId,
    signerName: input.signerName,
    signerEmailMasked: input.signerEmailMasked,
    signerPhoneMasked: input.signerPhoneMasked ?? null,
    organizationName: input.organizationName ?? null,
    signedAt: input.signedAt.toISOString(),
    verificationCode: input.verificationCode,
    verificationUrl: input.verificationUrl,
    originalDocumentHashSha256,
    signedPdfHashSha256,
    securityContext: input.securityContext ?? null,
    method: 'Assinatura eletrônica DOQYN',
    consentText: SIGNATURE_CONSENT_TEXT,
    previousSignatureCount: completedSignatureCount + (input.previousStamps?.length ?? 0),
  };

  const evidenceHashSha256 = createHash('sha256')
    .update(JSON.stringify(evidencePayload))
    .digest('hex');

  return {
    signedPdfBuffer,
    originalDocumentHashSha256,
    signedPdfHashSha256,
    evidencePayload,
    evidenceHashSha256,
  };
}
