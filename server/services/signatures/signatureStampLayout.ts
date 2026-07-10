/** Marcador usado no carimbo compacto — facilita contagem em PDFs já assinados. */
export const SIGNATURE_STAMP_MARKER = 'DOQYN';

export type SignatureStampData = {
  signerName: string;
  signedAt: Date;
  verificationCode: string;
};

export type SignatureStampLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MARGIN_X = 22;
const MARGIN_Y = 16;
const STAMP_WIDTH = 124;
const STAMP_HEIGHT = 32;
const STAMP_GAP = 5;
const STAMP_FONT_SIZE = 6;
const STAMP_LINE_HEIGHT = 8;
const STAMP_PADDING_X = 5;
const STAMP_PADDING_Y = 4;

export function getSignatureStampMetrics() {
  return {
    fontSize: STAMP_FONT_SIZE,
    lineHeight: STAMP_LINE_HEIGHT,
    paddingX: STAMP_PADDING_X,
    paddingY: STAMP_PADDING_Y,
    marker: SIGNATURE_STAMP_MARKER,
  };
}

function truncateSignerName(name: string, maxLength = 20): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function formatStampDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function buildCompactStampLines(stamp: SignatureStampData): string[] {
  const shortCode = stamp.verificationCode.replace(/^DOQYN-/i, '');
  return [
    truncateSignerName(stamp.signerName),
    `${formatStampDate(stamp.signedAt)} · ${SIGNATURE_STAMP_MARKER}`,
    shortCode,
  ];
}

/**
 * Posiciona carimbos no canto inferior esquerdo (coordenadas PDF: origem embaixo).
 * Empilha horizontalmente e quebra linha quando não couber na página.
 */
export function computeSignatureStampLayouts(
  pageWidth: number,
  stampCount: number,
): SignatureStampLayout[] {
  if (stampCount <= 0) return [];

  const maxPerRow = Math.max(
    1,
    Math.floor((pageWidth - MARGIN_X * 2 + STAMP_GAP) / (STAMP_WIDTH + STAMP_GAP)),
  );

  const layouts: SignatureStampLayout[] = [];
  for (let index = 0; index < stampCount; index += 1) {
    const column = index % maxPerRow;
    const row = Math.floor(index / maxPerRow);
    layouts.push({
      x: MARGIN_X + column * (STAMP_WIDTH + STAMP_GAP),
      y: MARGIN_Y + row * (STAMP_HEIGHT + STAMP_GAP),
      width: STAMP_WIDTH,
      height: STAMP_HEIGHT,
    });
  }

  return layouts;
}

/** Layout de um único carimbo pelo índice horizontal (0 = primeiro à esquerda). */
export function computeSignatureStampLayoutAtIndex(
  pageWidth: number,
  stampIndex: number,
): SignatureStampLayout {
  const safeIndex = Math.max(0, Math.floor(stampIndex));
  const layouts = computeSignatureStampLayouts(pageWidth, safeIndex + 1);
  const layout = layouts[safeIndex];
  if (!layout) {
    return {
      x: MARGIN_X,
      y: MARGIN_Y,
      width: STAMP_WIDTH,
      height: STAMP_HEIGHT,
    };
  }
  return layout;
}

export function getSignatureStampStride(): number {
  return STAMP_WIDTH + STAMP_GAP;
}
