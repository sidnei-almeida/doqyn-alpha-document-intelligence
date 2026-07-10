import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
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

function drawWrappedLines(input: {
  page: PDFPage;
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

function drawCompactStamp(input: {
  page: PDFPage;
  layout: ReturnType<typeof computeSignatureStampLayouts>[number];
  stamp: SignatureStampData;
  font: Awaited<ReturnType<PDFDocument['embedFont']>>;
}) {
  const metrics = getSignatureStampMetrics();
  const lines = buildCompactStampLines(input.stamp);

  input.page.drawRectangle({
    x: input.layout.x,
    y: input.layout.y,
    width: input.layout.width,
    height: input.layout.height,
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.4,
    color: rgb(1, 1, 1),
    opacity: 0.72,
  });

  drawWrappedLines({
    page: input.page,
    lines,
    x: input.layout.x + metrics.paddingX,
    startY: input.layout.y + input.layout.height - metrics.paddingY - metrics.fontSize,
    lineHeight: metrics.lineHeight,
    font: input.font,
    size: metrics.fontSize,
    color: rgb(0.2, 0.2, 0.2),
  });
}

function drawStampsOnPage(input: {
  page: PDFPage;
  pageWidth: number;
  currentStamp: SignatureStampData;
  completedSignatureCount: number;
  previousStamps?: SignatureStampData[];
  font: Awaited<ReturnType<PDFDocument['embedFont']>>;
}) {
  const completed = Math.max(0, input.completedSignatureCount);

  if (completed > 0) {
    const layout = computeSignatureStampLayoutAtIndex(input.pageWidth, completed);
    drawCompactStamp({
      page: input.page,
      layout,
      stamp: input.currentStamp,
      font: input.font,
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
  const stampPage = resolveSignatureStampTargetPage(
    pdfDoc,
    input.completedSignatureCount ?? 0,
  );
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
  });

  const certPage = pdfDoc.addPage();
  const { width, height } = certPage.getSize();
  let y = height - 56;

  certPage.drawText(SIGNATURE_CERTIFICATE_PAGE_TITLE, {
    x: 48,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  certPage.drawText(SIGNATURE_CERTIFICATE_PAGE_MARKER, {
    x: 0,
    y: 0,
    size: 0.01,
    opacity: 0,
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
    ...(input.previousStamps?.length
      ? [`Assinaturas anteriores nesta versão: ${input.previousStamps.length}`]
      : []),
    ...(completedSignatureCount > 0
      ? [`Assinaturas anteriores no documento: ${completedSignatureCount}`]
      : []),
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
