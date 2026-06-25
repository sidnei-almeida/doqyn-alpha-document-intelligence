import type { IncomingMessage } from 'node:http';
import { lookup } from 'mime-types';

export type ParsedMultipartFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
};

export async function parseMultipart(req: IncomingMessage): Promise<{
  fields: Record<string, string>;
  file?: ParsedMultipartFile;
}> {
  const contentType = req.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    return { fields: {} };
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);
  const boundary = contentType.split('boundary=')[1]?.trim();
  if (!boundary) return { fields: {} };

  const parts = buffer.toString('binary').split(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: ParsedMultipartFile | undefined;

  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;

    const nameMatch = part.match(/name="([^"]+)"/);
    const filenameMatch = part.match(/filename="([^"]+)"/);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1 || !nameMatch) continue;

    const value = part.slice(headerEnd + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');

    if (filenameMatch) {
      const fileBuffer = Buffer.from(value, 'binary');
      const filename = filenameMatch[1];
      file = {
        buffer: fileBuffer,
        filename,
        mimeType: lookup(filename) || 'application/octet-stream',
        size: fileBuffer.length,
      };
    } else {
      fields[nameMatch[1]] = value;
    }
  }

  return { fields, file };
}
