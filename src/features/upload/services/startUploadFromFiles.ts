// Import relativo (sem alias) para o módulo permanecer executável nos testes com tsx.
import { validateUploadFiles } from '../../document-send/utils/validateUpload';
import type { UploadContext, UploadQueueItem } from '../types';

export type PreparedUpload =
  | { ok: true; items: Array<UploadQueueItem & { file: File }> }
  | { ok: false; error: string };

let uploadSequence = 0;

function createUploadId(): string {
  uploadSequence += 1;
  return `upload-${Date.now()}-${uploadSequence}`;
}

/**
 * Valida os arquivos com as mesmas regras do fluxo legado (PDF, 15MB, 20/lote)
 * e prepara itens para a fila. A File fica fora do estado React — só aqui.
 */
export function prepareUploadItems(
  files: File[],
  context?: UploadContext,
  existingCount = 0,
): PreparedUpload {
  const validation = validateUploadFiles(files, existingCount);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const items = validation.files.map((file) => ({
    id: createUploadId(),
    file,
    fileName: file.name,
    fileSize: file.size,
    status: 'queued' as const,
    context,
  }));

  return { ok: true, items };
}
