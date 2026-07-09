import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { TrackingSecurityContext } from '../tracking/securityContext.js';

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
  securityContext?: TrackingSecurityContext;
  issuerOrganizationName?: string;
};

function formatSignedAt(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function drawWrappedLines(input: {
  page: ReturnType<PDFDocument['getPages']>[number];
  lines: string[];
  x: number;
  startY: number;
  lineHeight: number;
  font: Awaited<ReturnType<PDFDocument['embedFont']>>;
  size: number;
  color?: ReturnType<typeof rgb>;
}) {
  let y = input.startY;
  for (const line of input.lines) {
    input.page.drawText(line, {
      x: input.x,
      y,
      size: input.size,
      font: input.font,
      color: input.color ?? rgb(0.12, 0.12, 0.12),
    });
    y -= input.lineHeight;
  }
  return y;
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
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width: pageWidth } = lastPage.getSize();

  const stampLines = [
    'Assinado eletronicamente por:',
    `Nome: ${input.signerName}`,
    `E-mail: ${input.signerEmailMasked}`,
    ...(input.signerPhoneMasked ? [`Telefone: ${input.signerPhoneMasked}`] : []),
    `Data/Hora: ${formatSignedAt(input.signedAt)} BRT`,
    'Método: Assinatura eletrônica DOQYN',
    `Código de verificação: ${input.verificationCode}`,
    `Hash SHA-256: ${originalDocumentHashSha256.slice(0, 24)}…`,
  ];

  lastPage.drawRectangle({
    x: 40,
    y: 28,
    width: Math.min(pageWidth - 80, 420),
    height: stampLines.length * 12 + 18,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  drawWrappedLines({
    page: lastPage,
    lines: stampLines,
    x: 52,
    startY: 28 + stampLines.length * 12 + 4,
    lineHeight: 12,
    font: regularFont,
    size: 9,
  });

  const certPage = pdfDoc.addPage();
  const { width, height } = certPage.getSize();
  let y = height - 56;

  certPage.drawText('Certificado de Assinatura Eletrônica', {
    x: 48,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 28;

  const locationParts = [
    input.securityContext?.city,
    input.securityContext?.region,
    input.securityContext?.country,
  ].filter(Boolean);

  const certificateLines = [
    `Documento: ${input.documentName}`,
    `Document ID: ${input.documentId}`,
    `Version ID: ${input.versionId}`,
    `Signature Request ID: ${input.signatureRequestId}`,
    `Signature ID: ${input.signatureId}`,
    `Signatário: ${input.signerName}`,
    `E-mail: ${input.signerEmailMasked}`,
    ...(input.signerPhoneMasked ? [`Telefone: ${input.signerPhoneMasked}`] : []),
    ...(input.organizationName ? [`Organização: ${input.organizationName}`] : []),
    ...(input.issuerOrganizationName ? [`Emissor: ${input.issuerOrganizationName}`] : []),
    `Data/Hora da assinatura: ${formatSignedAt(input.signedAt)} BRT`,
    `IP: ${input.securityContext?.ipAddressMasked ?? '—'}`,
    `Local aproximado: ${locationParts.length ? locationParts.join(', ') : '—'}`,
    `Navegador: ${input.securityContext?.browser ?? '—'} ${input.securityContext?.browserVersion ?? ''}`.trim(),
    `Sistema: ${input.securityContext?.os ?? '—'} ${input.securityContext?.osVersion ?? ''}`.trim(),
    `Dispositivo: ${input.securityContext?.deviceType ?? '—'}`,
    `Hash SHA-256 (original): ${originalDocumentHashSha256}`,
    `Código verificador: ${input.verificationCode}`,
    `Validação: ${input.verificationUrl}`,
  ];

  y = drawWrappedLines({
    page: certPage,
    lines: certificateLines,
    x: 48,
    startY: y,
    lineHeight: 14,
    font: regularFont,
    size: 10,
  });

  const qrPng = await QRCode.toBuffer(input.verificationUrl, {
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdfDoc.embedPng(qrPng);
  certPage.drawImage(qrImage, {
    x: width - 188,
    y: height - 188,
    width: 140,
    height: 140,
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
