import type { IncomingMessage } from 'node:http';
import busboy from 'busboy';
import { lookup } from 'mime-types';
import { getStorageConfig } from '../storage/storageConfig.js';
import { ServiceError } from './serviceErrors.js';

export type ParsedMultipartFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
};

export type ParseMultipartOptions = {
  /** Teto de bytes do arquivo. Default: `maxUploadBytes` da configuração de storage. */
  maxFileBytes?: number;
  /** Teto de bytes por campo de texto. */
  maxFieldBytes?: number;
  /** Número máximo de campos de texto aceitos. */
  maxFields?: number;
};

const DEFAULT_MAX_FIELD_BYTES = 1024 * 1024;
const DEFAULT_MAX_FIELDS = 32;

/** Quanto do corpo recusado ainda vale a pena drenar antes de cortar a conexão. */
const DRAIN_LIMIT_BYTES = 2 * 1024 * 1024;

function fileTooLargeError(maxFileBytes: number): ServiceError {
  const maxMb = Math.floor(maxFileBytes / (1024 * 1024));
  return new ServiceError(`Arquivo excede o limite de ${maxMb} MB.`, 'FILE_TOO_LARGE', 413);
}

/**
 * Parser multipart em streaming.
 *
 * A versão anterior acumulava o corpo inteiro com `Buffer.concat`, convertia para string binária e
 * fazia `split` — operações síncronas O(n) que **bloqueiam o event loop**, sem teto de tamanho. Num
 * VPS de 2 vCPU isso prendia metade da máquina enquanto o worker de preview disputava a outra.
 *
 * Aqui o busboy consome o socket em pedaços e aborta assim que o arquivo passa de `maxFileBytes`,
 * antes de terminar de ler o corpo.
 *
 * O arquivo ainda é materializado em memória porque `uploadDocument` recebe um `Buffer`. Eliminar
 * também esse buffer é o Passo 9 do plano de escala (upload direto ao R2).
 */
export async function parseMultipart(
  req: IncomingMessage,
  options: ParseMultipartOptions = {},
): Promise<{
  fields: Record<string, string>;
  file?: ParsedMultipartFile;
}> {
  const contentType = req.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    return { fields: {} };
  }

  const maxFileBytes = options.maxFileBytes ?? getStorageConfig().maxUploadBytes;

  return new Promise((resolve, reject) => {
    let bb: busboy.Busboy;
    try {
      bb = busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: maxFileBytes,
          fields: options.maxFields ?? DEFAULT_MAX_FIELDS,
          fieldSize: options.maxFieldBytes ?? DEFAULT_MAX_FIELD_BYTES,
        },
      });
    } catch {
      // Cabeçalho multipart malformado (boundary ausente, por exemplo).
      resolve({ fields: {} });
      return;
    }

    const fields: Record<string, string> = {};
    let file: ParsedMultipartFile | undefined;
    let settled = false;

    /**
     * Depois de rejeitar, o restante do corpo precisa ir para algum lugar: sem drenar, o socket
     * fica pendurado até o timeout do cliente. Mas drenar sem teto é o que o passo quer evitar —
     * um corpo de 5 GB custaria 5 GB de leitura mesmo já tendo sido recusado. Drena o suficiente
     * para o cliente conseguir ler a resposta e corta o resto.
     */
    const drainAndDiscard = () => {
      req.unpipe(bb);

      let drained = 0;
      req.on('data', (chunk: Buffer) => {
        drained += chunk.length;
        if (drained > DRAIN_LIMIT_BYTES) req.destroy();
      });
      req.resume();
    };

    const settle = (
      error: Error | null,
      value?: { fields: Record<string, string>; file?: ParsedMultipartFile },
    ) => {
      if (settled) return;
      settled = true;

      if (error) {
        drainAndDiscard();
        reject(error);
        return;
      }

      resolve(value ?? { fields });
    };

    // `req.pipe(bb)` não propaga erro da origem para o destino: sem estes handlers, um cliente que
    // some no meio do upload deixa a promise pendurada para sempre (e o buffer já acumulado preso
    // na heap), ou derruba o processo com um 'error' sem ouvinte.
    req.on('error', (error: Error) => {
      req.unpipe(bb);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    req.on('aborted', () => {
      req.unpipe(bb);
      if (!settled) {
        settled = true;
        reject(new ServiceError('Envio interrompido pelo cliente.', 'UPLOAD_ABORTED', 400));
      }
    });

    // Fecha o caso do `destroy()` silencioso, que não emite 'error' nem 'aborted'.
    req.on('close', () => {
      if (settled) return;
      queueMicrotask(() => {
        if (settled) return;
        settled = true;
        req.unpipe(bb);
        reject(new ServiceError('Envio interrompido pelo cliente.', 'UPLOAD_ABORTED', 400));
      });
    });

    bb.on('field', (name: string, value: string, info: busboy.FieldInfo) => {
      // busboy trunca campo acima de `fieldSize` e ainda assim emite 'field'. Aceitar o valor
      // parcial faria, por exemplo, `JSON.parse(fields.accessGroups)` estourar como erro 500.
      if (info.valueTruncated || info.nameTruncated) {
        settle(
          new ServiceError(
            `Campo "${name}" excede o tamanho máximo permitido.`,
            'FIELD_TOO_LARGE',
            413,
          ),
        );
        return;
      }
      fields[name] = value;
    });

    bb.on('file', (_name: string, stream: NodeJS.ReadableStream, info: busboy.FileInfo) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      // Emitido pelo busboy quando `limits.fileSize` estoura — rejeita sem ler o resto.
      stream.on('limit', () => {
        truncated = true;
        settle(fileTooLargeError(maxFileBytes));
      });

      stream.on('end', () => {
        if (truncated || settled) return;
        const filename = info.filename?.trim() || 'arquivo';
        file = {
          buffer: Buffer.concat(chunks, size),
          filename,
          mimeType: lookup(filename) || info.mimeType || 'application/octet-stream',
          size,
        };
      });
    });

    bb.on('error', (error: unknown) => {
      settle(error instanceof Error ? error : new Error(String(error)));
    });

    bb.on('close', () => {
      settle(null, { fields, file });
    });

    req.pipe(bb);
  });
}
