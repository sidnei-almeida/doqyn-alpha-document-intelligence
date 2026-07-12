export const NON_EXTRACTABLE_TEXT_MESSAGE =
  'Texto não extraível. Revisão/OCR necessário.';

const NON_EXTRACTABLE_CODES = new Set([
  'INSUFFICIENT_TEXT',
  'TEXT_EXTRACTION_FAILED',
  'VISION_OCR_FAILED',
]);

const NON_EXTRACTABLE_PHRASES = [
  'texto insuficiente',
  'não extraível',
  'nao extraivel',
  'escaneado',
  'baseado em imagem',
  'ocr automático falhou',
];

export function isNonExtractablePdfError(input: {
  message?: string;
  code?: string;
}): boolean {
  if (input.code && NON_EXTRACTABLE_CODES.has(input.code)) {
    return true;
  }

  const message = input.message?.toLowerCase() ?? '';
  return NON_EXTRACTABLE_PHRASES.some((phrase) => message.includes(phrase));
}

export function validateBulkQueueFile(file: File | undefined | null): {
  valid: boolean;
  reason?: string;
} {
  if (!file) {
    return { valid: false, reason: 'Arquivo ausente no item da fila.' };
  }

  if (!(file instanceof File)) {
    return { valid: false, reason: 'Referência de arquivo inválida no item da fila.' };
  }

  if (file.size <= 0) {
    return { valid: false, reason: 'Arquivo vazio no item da fila.' };
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, reason: 'Arquivo da fila não é PDF.' };
  }

  return { valid: true };
}
