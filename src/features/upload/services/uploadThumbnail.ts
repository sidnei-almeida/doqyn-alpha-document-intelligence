import { getDocument } from 'pdfjs-dist';

import { setupPdfWorker } from '@/features/documents/viewer/pdfWorkerSetup';

/**
 * A miniatura do que está subindo — e é o arquivo de verdade, não um desenho de documento.
 *
 * A antessala do login pode inventar a página, porque lá não existe arquivo nenhum. Aqui existe, e
 * quem enviou sabe o que enviou: uma folha genérica varrida enquanto sobe uma nota fiscal lê como
 * enfeite no primeiro olhar. Imagem entra como ela mesma; PDF entra pela primeira página.
 *
 * Custa uma renderização por arquivo, em largura de miniatura — é o que cabe ao lado do nome, e
 * renderizar maior seria pagar por pixel que ninguém vê.
 */
const THUMB_WIDTH = 132;

/** Um render por vez: subir dez arquivos não pode virar dez renderizações concorrentes. */
let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

export type UploadThumbnail = {
  url: string;
  /** Largura/altura da página lida, para a miniatura não deformar o que mostra. */
  ratio: number;
  /** `blob` precisa de revogação; `data` morre com a referência. */
  kind: 'blob' | 'data';
};

function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

async function renderPdfFirstPage(file: File): Promise<UploadThumbnail | null> {
  setupPdfWorker();

  const buffer = await file.arrayBuffer();
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Fundo branco explícito: PDF sem fundo próprio renderiza transparente, e no painel escuro a
    // página apareceria como um vazio recortado em vez de papel.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    return {
      url: canvas.toDataURL('image/webp', 0.72),
      ratio: base.width / base.height,
      kind: 'data',
    };
  } finally {
    void doc.destroy();
  }
}

async function measureImage(file: File): Promise<UploadThumbnail> {
  const url = URL.createObjectURL(file);
  const ratio = await new Promise<number>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth / image.naturalHeight || 1 / 1.414);
    image.onerror = () => resolve(1 / 1.414);
    image.src = url;
  });
  return { url, ratio, kind: 'blob' };
}

/**
 * Devolve `null` quando não dá para mostrar — PDF cifrado, arquivo corrompido, formato que o
 * navegador não abre. A fila continua com o ícone de sempre: não ter miniatura é um detalhe visual,
 * e derrubar o envio por causa dele seria trocar o essencial pelo enfeite.
 */
export async function createUploadThumbnail(file: File): Promise<UploadThumbnail | null> {
  try {
    if (isImage(file)) return await measureImage(file);
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return await enqueue(() => renderPdfFirstPage(file));
    }
    return null;
  } catch {
    return null;
  }
}

export function releaseUploadThumbnail(thumbnail?: UploadThumbnail): void {
  if (thumbnail?.kind === 'blob') URL.revokeObjectURL(thumbnail.url);
}
